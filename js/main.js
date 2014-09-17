if (!window.owc) {
    window.owc = {};
}
var owc = window.owc;

owc.client = function(options) {
    this.context =  new Jsonix.Context(
        [XLink_1_0, OWS_1_0_0, Filter_1_0_0, GML_2_1_2, SLD_1_0_0, OWC_0_3_1],
        {
            namespacePrefixes : {
               "http://www.w3.org/1999/xlink": "xlink"
            }
        }
    );
    this.unmarshaller = this.context.createUnmarshaller();
    this.marshaller = this.context.createMarshaller();
};

owc.client.prototype.loadContext = function(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    var me = this;
    console.info("Reading document: " + url);
    xmlhttp.open("GET", url, true);
    xmlhttp.onload = function() {
        var featureTypes = [];
        var context = me.unmarshaller.unmarshalDocument(this.responseXML);

        console.info("Unmarshalled: ", context);
        callback.call(me, context.value);
    };
    xmlhttp.send();
};

owc.client.prototype.writeContext = function(obj) {
    return this.marshaller.marshalDocument(obj);
};

// application code
var map;
function onContextLoaded(context) {
    // first remove any existing layer
    map.getLayers().forEach(function(layer) {
        console.info('Layer removed: ', layer);
        map.removeLayer(layer);
    });
    // set the map size (General.Window)
    if (context.general.window) {
        $('#map').width(context.general.window.width);
        $('#map').height(context.general.window.height);
        map.updateSize();
    }


    // set the General.BoundingBox
    var bbox = context.general.boundingBox.value;
    var ll = bbox.lowerCorner;
    var ur = bbox.upperCorner;
    var extent = ll.concat(ur);
    var projection = bbox.crs;
    // reproject in case bbox's projection doesn't match map's projection
    extent = ol.proj.transformExtent(extent, map.getView().getProjection(), projection);
    map.getView().fitExtent(extent, map.getSize());

    // load the resources
    var layers = context.resourceList.layer;
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.name.indexOf('google') != -1) {
            // pass
        } else if (layer.name.indexOf('osm') != -1) {
            var osmSource = new ol.source.OSM();
            map.addLayer(new ol.layer.Tile({source: osmSource}));
        } else {
            var server = layer.server[0];
            if (server.service == 'urn:ogc:serviceType:WMS') {
                var onlineResource = server.onlineResource[0];
                var source = new ol.source.ImageWMS({
                    url: onlineResource.href,
                    params: {'LAYERS': layer.name}
                });
                map.addLayer(new ol.layer.Image({
                    source: source,
                    opacity: layer.opacity || 1,
                    visible: !layer.hidden
                }));
            }
        }
    }
}

function writeContext() {

    var extent = map.getView().calculateExtent(map.getSize());

    var general = {
        boundingBox: {
            name: {
                "namespaceURI": "http://www.opengis.net/ows",
                "localPart": "BoundingBox",
                "prefix": "ows"
            },
            value: {
                crs: map.getView().getProjection().getCode(),
                lowerCorner: [extent[0], extent[1]],
                upperCorner: [extent[2], extent[3]],
            }
        },
        title: "The title for the context"
    };

    var resourceList = {
        layer: []
    };
    map.getLayers().forEach(function(layer) {
        var source = layer.getSource();
        var url = "";
        var name;
        if (source instanceof ol.source.OSM) {
            name = "{type=osm}"
        } else if (source instanceof ol.source.ImageWMS) {
            name = source.getParams().LAYERS;
            url = layer.getSource().getUrl()
        }
        resourceList.layer.push({
            hidden: layer.getVisible(),
            name: name,
            server: [{
                onlineResource: [{
                    href: url
                }],
                service: "urn:ogc:serviceType:WMS"
            }]
        })
    });

    var context = {
        version: "0.3.1",
        id: "ows-context-ex-1-v3",
        general: general,
        resourceList: resourceList
    };

    var xml = myOwcClient.writeContext({
        name: {
            localPart: 'OWSContext',
            namespaceURI: "http://www.opengis.net/ows-context",
            prefix: "ows-context",
            string: "{http://www.opengis.net/ows-context}ows-context:OWSContext"
        },
        value: context
    });
    return xml;
}

map = new ol.Map({
    controls: ol.control.defaults({
        attributionOptions: ({
            collapsible: false
        })
    }),
    target: 'map'
});
var myOwcClient = new owc.client();

$('#contexts a').on('click', function() {
    var link = $(this);
    var url = link.attr('data-url');
    myOwcClient.loadContext('contexts/' + url, onContextLoaded);
    return false;
});

$('#export').on('click', function() {
    var xml = writeContext();

    var string = new XMLSerializer().serializeToString(xml);
    var base64 = exampleNS.strToBase64(string);
    $(this).attr('href', 'data:xml;base64,' + base64);
});
