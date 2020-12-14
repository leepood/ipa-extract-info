#!/usr/bin/env node
const fs = require('fs');
const { promisify } = require('util');
const extract = require('../index');

(async () => {
    const ipaPath = process.argv[2];
    if (!ipaPath || ipaPath.length === 0) {
        console.error("file path of ipa should not empty");
        return;
    }
    try {
        const fd = await (promisify(fs.open))(ipaPath)
        const info = await extract(fd);
        console.log(info);
    } catch (error) {
        console.error(error);
    }
})();
