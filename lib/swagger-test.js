'use strict';

var template = require('url-template');
const util = require('util')

function getUriScheme(spec) {
    return ((spec.schemes || []).concat(['https']))[0];
}

function parseXample(spec, uri, method, xample) {
    var uriTemplate = template.parse(uri);
    var expandedUri = uriTemplate.expand(xample.request.params);
    xample.request.method = method;
    xample.request.uri = getUriScheme(spec) + '://' + spec.host + spec.basePath + expandedUri;
    return {
        description: xample.description || method + ' ' + uri,
        request: xample.request,
        responses: xample.responses
    };
}

function inferXample(spec, uri, method, operation, statusString) {
    var request = {
        method: method,
        uri: getUriScheme(spec) + '://' + spec.host + spec.basePath + uri
    };
    var responses = {};
    if (operation.responses && operation.responses[statusString]) {
        responses[statusString] = operation.responses[statusString];
    }
    return {
        description: method + ' ' + uri,
        request: request,
        responses: responses
    };
}

function parse(spec, options) {

    options = options || {};

    var xamples = [];

    Object.keys(spec.paths || {}).forEach(function (uri) {
        var path = spec.paths[uri];
        Object.keys(path).forEach(function (method) {
            var operation = path[method];
            if (operation['x-amples']) {
                operation['x-amples'].forEach(function (xample) {
                    xamples.push(parseXample(spec, uri, method, xample));
                });
            } else if (options.inferXamples) {
                Object.keys(operation.responses || {}).forEach(function (statusString) {
                    if(statusString === '200'){
                        xamples.push(inferXample(spec, uri, method, operation, statusString));
                    }
                });
            }
        });
    });
    return xamples;
}

function completeInternalModel(spec, key, property){

    if(property.type){

        if(property.type === 'object'){
            // if this is a subObject that's referenced in a swagger model, strip the wrapping {}
            // and add each key in it, passing it recursively through this function
            var subModel = {};

            Object.keys(property.properties || {}).forEach(function (key) {
                subModel[key] = completeInternalModel(spec, key, property.properties[key]);
            });

            return subModel;
        } else {
            // if this is an actual API key and it contains the type (string, int etc), return just the key
            return key;
        }
    }

    // if this is a reference to a swagger model, find that model and return its keys
    if(property['$ref']){
        var swaggerPath = property['$ref'].replace("#/definitions/", "");
        var model = completeInternalModel(spec, key, spec.definitions[swaggerPath]);

        return model;
    }
}

function modelFromSpecRef(spec, model){

    var properties = model.schema.properties;
    var completeProperties = {};

    Object.keys(properties || {}).forEach(function (key) {
        completeProperties[key] = completeInternalModel(spec, key, properties[key]);
    });

    return completeProperties;
}

function refactor(spec, model){
    delete model.headers;

    model.body = modelFromSpecRef(spec, model);

    delete model.schema;
    return model;
}

module.exports.parse = parse;
module.exports.refactor = refactor;
