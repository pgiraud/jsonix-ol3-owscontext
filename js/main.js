if (!window.owc) {
    window.owc = {};
}
var owc = window.owc;

owc.client = function(options) {
    this.context =  new Jsonix.Context([XLink_1_0, OWS_1_0_0, Filter_1_0_0, GML_2_1_2, SLD_1_0_0, OWC_0_3_1]);
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
        var context = me.unmarshaller.unmarshalDocument(this.responseXML).value;

        console.info("Unmarshalled: ", context);
        callback.call(me, context);
    };
    xmlhttp.send();
};

// application code
var map;
function onContextLoaded(context) {
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
