const npm = require('npm');
const webpack = require('webpack');
const rimraf = require('rimraf');
const ncp = require('ncp').ncp;
const path = require('path');
const mkdirp = require('mkdirp');
const fs = require('fs');
const configRenderer = require('../webpack/webpack.config.production.babel');
const configMain = require('../webpack/webpack.config.electron.babel');

// Start the madness!
process.nextTick(async () => {
  try {
    await build();
  } catch (err) {
    console.error('[build] Failed to build', err);
  }
});

async function build () {
  // Remove folders first
  console.log('[build] Removing existing directories');
  await emptyDir('../build');

  // Build the things
  console.log('[build] Building Webpack');
  await buildWebpack(configRenderer);
  await buildWebpack(configMain);

  // Copy necessary files
  console.log('[build] Copying files');
  await copyFiles('../bin', '../build/');
  await copyFiles('../app/static', '../build/static');
  await copyFiles('../app/icons/', '../build/');

  // Generate package.json
  await generatePackageJson('../package.json', '../app/package.json', '../build/package.json');

  // Install Node modules
  console.log('[build] Installing dependencies');
  await install('../build/');

  console.log('[build] Complete!');
}

async function buildWebpack (config) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err || stats.hasErrors()) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function emptyDir (relPath) {
  return new Promise((resolve, reject) => {
    const dir = path.resolve(__dirname, relPath);
    rimraf(dir, err => {
      if (err) {
        reject(err);
      } else {
        mkdirp.sync(dir);
        resolve();
      }
    });
  });
}

async function copyFiles (relSource, relDest) {
  return new Promise((resolve, reject) => {
    const source = path.resolve(__dirname, relSource);
    const dest = path.resolve(__dirname, relDest);
    ncp(source, dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function install (relDir) {
  return new Promise((resolve, reject) => {
    const prefix = path.resolve(__dirname, relDir);
    npm.load({prefix, production: true}, err => {
      if (err) {
        return reject(err);
      }

      npm.commands.install([prefix], err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

function generatePackageJson (relBasePkg, relAppPkg, relOutPkg) {
  // Read package.json's
  const basePath = path.resolve(__dirname, relBasePkg);
  const appPath = path.resolve(__dirname, relAppPkg);
  const outPath = path.resolve(__dirname, relOutPkg);

  const basePkg = JSON.parse(fs.readFileSync(basePath));
  const appPkg = JSON.parse(fs.readFileSync(appPath));

  appPkg.dependencies = {};

  // Figure out which dependencies to pack
  const allDependencies = Object.keys(basePkg.dependencies);
  const packedDependencies = basePkg.packedDependencies;
  const unpackedDependencies = allDependencies.filter(
    name => !packedDependencies.includes(name)
  );

  // Add dependencies
  for (const name of unpackedDependencies) {
    const version = basePkg.dependencies[name];
    if (!version) {
      throw new Error(`Failed to find packed dep "${name}" in dependencies`);
    }
    appPkg.dependencies[name] = version;
    console.log(`[build] Setting packed dep ${name}`);
  }

  fs.writeFileSync(outPath, JSON.stringify(appPkg, null, 2));
}
