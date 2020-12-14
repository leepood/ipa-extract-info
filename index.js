const promisify = require('util').promisify;
const fromFd = promisify(require('yauzl').fromFd);
const collect = promisify(require('collect-stream'));
const bplistParse = require('bplist-parser').parseBuffer;
const plistParse = require('plist').parse;
const reg = require('./lib/reg');

const chrOpenChevron = 60;
const chrLowercaseB = 98;

module.exports = async function (fd, { autoClose = true } = {}) {
  const zip = await fromFd(fd, { autoClose });
  zip.openReadStreamAsync = promisify(zip.openReadStream.bind(zip));
  zip.on('error', (err) => {
    throw err;
  });

  const readPlist = async (matchInfo) => {
    const { entry } = await findEntry(zip, matchInfo);

    if (!entry) {
      return null;
    }

    const file = await zip.openReadStreamAsync(entry);
    const src = await collect(file);

    let parsed = null;
    if (src[0] === chrOpenChevron) {
      parsed = plistParse(src.toString());
    } else if (src[0] === chrLowercaseB) {
      parsed = bplistParse(src);
    }
    return parsed;
  }

  const findMetaInfo = async () => {
    const matchInfo = f => {
      return f === 'iTunesMetadata.plist';
    }
    return await readPlist(matchInfo);
  }

  const findInfo = async () => {
    const matchInfo = f => reg.info.test(f);
    return await readPlist(matchInfo);
  }

  const findProv = async () => {
    const matchProv = f => reg.mobileprovision.test(f);
    const { entry } = await findEntry(zip, matchProv);
    if (!entry) {
      return null;
    }
    const file = await zip.openReadStreamAsync(entry);
    return collect(file);
  };

  const [info, mobileprovision, metaDatas] = await Promise.all([findInfo(),
  findProv(),
  findMetaInfo()]);

  let metaInfo = undefined;
  if (metaDatas && metaDatas.length > 0) {
    metaInfo = metaDatas[0];
  }
  return {
    info,
    mobileprovision,
    metaInfo
  };
};

function findEntry(zip, match) {
  return new Promise((resolve, reject) => {
    let found = false;
    let onentry;
    zip
      .on('entry', onentry = async (entry) => {
        try {
          if (!match(entry.fileName)) { return; }
          found = true;
          zip.removeListener('entry', onentry);
          return resolve({ entry });
        } catch (err) {
          return reject(err);
        }
      })
      .on('end', () => {
        const entry = null;
        if (!found) { return resolve({ entry }); }
      });
  });
}
