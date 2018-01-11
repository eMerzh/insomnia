'use strict';

let requestCount = 1;
let requestGroupCount = 1;

const FORMAT_MAP = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  text: 'text/plain'
};

module.exports.id = 'swagger-2';
module.exports.name = 'Swagger v2';
module.exports.description = 'Swagger v2';

module.exports.convert = function (rawData) {
  requestCount = 1;
  requestGroupCount = 1;

  let data;
  try {
    data = JSON.parse(rawData);
  } catch (e) {
    return null;
  }

  if (data.swagger !== "2.0") {
    // Bail early if it's not the expected format
    return null;
  }

  return importCollection(data)
};

function importCollection (collection) {
  const collectionFolder = {
    parentId: '__WORKSPACE_ID__',
    _id: `__GRP_${requestGroupCount++}__`,
    _type: 'request_group',
    name: collection.info.title,
    description: collection.info.description,
  };
  const collectionEnv = {
    "_type": "environment",
    "_id": "__ENVIRONMENT_1__",
    "parentId": "__WORKSPACE_ID__",
    "name": "",
    "data": {
      "scheme": collection.schemes[0],
      "host": collection.host,
      "basePath": collection.basePath,
      "baseUrl": "{{scheme}}://{{host}}{{basePath}}"
    }
  };

  let collectionTag = {};
  for (const tag of collection.tags) {
    collectionTag[tag.name]= importFolderItem(tag, collectionFolder._id);
  }
  // console.error(collectionTag);
  return [
    collectionFolder,
    collectionEnv,
    ...Object.values(collectionTag),
    ...importItem(collection.paths, collectionTag, collectionFolder._id)
  ]
}

function importItem (items, collectionTag, parentId = '__WORKSPACE_ID__') {
  let resources = [];
  for (const [pathItem, methods] of Object.entries(items)) {
    for(const [method, item] of Object.entries(methods)) {
      resources = [
        ...resources,
        importRequestItem(collectionTag, pathItem, method, item, parentId)
      ];
    }
  }

  return resources;
}

function importFolderItem (item, parentId) {
  return {
    parentId,
    _id: `__GRP_${requestGroupCount++}__`,
    _type: 'request_group',
    name: item.name,
    description: item.description || '',
  }
}

function importRequestItem (collectionTag, url, method, item, parentId) {
  return {
    parentId: item.tags ? collectionTag[item.tags[0]]._id : parentId,
    _id: `__REQ_${requestCount++}__`,
    _type: 'request',
    name: item.summary || url,
    summary: item.summary || '',
    description: item.description || '',
    url: `{{baseUrl}}${url}`,
    method: method || 'GET',
    headers: getParameters(item.parameters, 'header'),
    parameters: getParameters(item.parameters, 'query'),
    body: importBody(item),
  }
}

function getParameters(parameters, type) {
  return parameters.filter((i) => i.in === type).map(i=> {
    return {
      "name": i.name,
      "value":  i.default || "",
    }
  });
}

function importBody() {
  // empty
  return {};
}
