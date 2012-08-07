dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("esri.map");
dojo.require("esri.layers.FeatureLayer");
dojo.require("esri.dijit.AttributeInspector-all");
dojo.require("esri.IdentityManager");
dojo.require("esri.tasks.find");
dojo.require("dojox.grid.DataGrid");
dojo.require("dojo.data.ItemFileReadStore");

var map, cred = "esri_jsapi_id_manager_data"; // cookie/local storage name

var find, params, grid;


function init() {
    esri.config.defaults.io.proxyUrl = "https://cvag01.mojavedata.gov/proxy_net/proxy.ashx";
    // store credentials/serverInfos before the page unloads
    dojo.addOnUnload(storeCredentials);
    // look for credentials in local storage
    loadCredentials();

    var startExtent = new esri.geometry.Extent(-116.7055,33.9913,-115.7981,33.5033, new esri.SpatialReference({wkid:4326}));

    map = new esri.Map("mapCanvas",{
			   extent:esri.geometry.geographicToWebMercator(startExtent)
		       });
    dojo.connect(map, "onLoad", function() {
		     dojo.connect(dijit.byId('mapCanvas'), 'resize', map,map.resize);
		 });

    dojo.connect(map, "onLayersAddResult", initSelectToolbar);

    var basemap = new esri.layers.ArcGISTiledMapServiceLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer");
    map.addLayer(basemap);

    var ownershipMSL = new esri.layers.ArcGISDynamicMapServiceLayer("https://cvag01.mojavedata.gov/ArcGIS/rest/services/admin/Ownership_Editor/MapServer");
    ownershipMSL.setDisableClientCaching(true);
    map.addLayer(ownershipMSL);


    var ownershipFL = new esri.layers.FeatureLayer("https://cvag01.mojavedata.gov/ArcGIS/rest/services/admin/Ownership_Editor/FeatureServer/0", {
						       mode: esri.layers.FeatureLayer.MODE_SELECTION,
						       outFields: ["APN","OWNER","CONS_STATUS","POST_MOU","ACQ_DATE","CREDIT_STATE","CREDIT_PERMITTEE","CREDIT_COMP"]    });

    find = new esri.tasks.FindTask("https://cvag01.mojavedata.gov/ArcGIS/rest/services/admin/Ownership_Editor/MapServer");
    params = new esri.tasks.FindParameters();
    params.returnGeometry = true;
    params.layerIds = [0];
    params.searchFields = ["APN"];

    var selectionSymbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_NULL, new esri.symbol.SimpleLineSymbol("dashdot", new dojo.Color("yellow"), 2),null);
    ownershipFL.setSelectionSymbol(selectionSymbol);

    dojo.connect(ownershipFL, "onEditsComplete", function() {
		     ownershipFL.refresh();
		 });

    map.addLayers([ownershipFL]);

    function loadCredentials() {
	var idJson, idObject;

	if ( supports_local_storage() ) {
            // read from local storage
            idJson = window.localStorage.getItem(cred);
	} else {
            // read from a cookie
            idJson = dojo.cookie(cred);
	}

	if ( idJson && idJson != "null" && idJson.length > 4) {
            idObject = dojo.fromJson(idJson);
            esri.id.initialize(idObject);
	} else {
            // console.log("didn't find anything to load :(");
	}
    }

    function storeCredentials() {      
	// make sure there are some credentials to persist
	if ( esri.id.credentials.length === 0 ) {
            return;
	}

	// serialize the ID manager state to a string
	var idString = dojo.toJson(esri.id.toJson());
	// store it client side
	if ( supports_local_storage() ) {
            // use local storage
            window.localStorage.setItem(cred, idString);
            // console.log("wrote to local storage");
	} else {
            // use a cookie
            dojo.cookie(cred, idString, { expires: 1 });
            // console.log("wrote a cookie :-/");
	}
    }

    function supports_local_storage() {
	try {
            return "localStorage" in window && window["localStorage"] !== null;
	} catch( e ) {
            return false;
	}
    }

}

function initSelectToolbar(results) {
    
    var ownershipFL = results[0].layer;
    var selectQuery = new esri.tasks.Query();


    dojo.connect(map, "onClick", function(evt) {
		     selectQuery.geometry = evt.mapPoint;
		     ownershipFL.selectFeatures(selectQuery, esri.layers.FeatureLayer.SELECTION_NEW, function(features) {
						    if (features.length > 0) {
							//store the current feature
							updateFeature = features[0];
							map.infoWindow.setTitle(features[0].getLayer().name);
							map.infoWindow.show(evt.screenPoint,map.getInfoWindowAnchor(evt.screenPoint));
						    } else {
							map.infoWindow.hide();
						    }
						});

		 });

    dojo.connect(map.infoWindow, "onHide", function() {
		     ownershipFL.clearSelection();
		 });
    var layerInfos = [{'featureLayer':ownershipFL,
		       'showAttachments':false,
		       'isEditable': true,
		       'fieldInfos': [
			   {'fieldName': 'APN', 'isEditable':false, 'label':'APN:'},
			   {'fieldName': 'OWNER', 'isEditable':true, 'tooltip': 'The Ownership of this Parcel', 'label':'Owner:'},
			   {'fieldName': 'CONS_STATUS', 'isEditable':true, 'tooltip': 'Is this Parcel Conserved?','label':'Conserved?:'},
			   {'fieldName': 'POST_MOU', 'isEditable':true, 'tooltip': 'Was this Parcel Conserved after 1996?', 'label':'Post MOU Conserved?:'},
			   {'fieldName': 'ACQ_DATE', 'isEditable':true, 'tooltip': 'Date Parcel was Acquired for Conservation', 'label':'Acquisition Date:'},
			   {'fieldName': 'CREDIT_STATE', 'isEditable':true, 'tooltip': 'Federal/State Funding (Percent)', 'label':'Federal/State Funding (Percent):'},
			   {'fieldName': 'CREDIT_PERMITTEE', 'isEditable':true, 'tooltip': 'Local Permittee Funding (Percent)', 'label':'Local Permittee Funding (Percent):'},
			   {'fieldName': 'CREDIT_COMP', 'isEditable':true, 'tooltip': 'Complementary Funding (Percent)', 'label':'Complementary Funding (Percent):'}
		       ]}];

    

    var attInspector = new esri.dijit.AttributeInspector({
							     layerInfos:layerInfos
							 },
							 dojo.create("div")
							);
    
    //add a save button next to the delete button
    var saveButton = new dijit.form.Button({label:"Save","class":"saveButton"});
    dojo.place(saveButton.domNode, "after");

    dojo.connect(saveButton,"onClick",function(){
		     updateFeature.getLayer().applyEdits(null, [updateFeature],null);
		 });

    dojo.connect(attInspector, "onAttributeChange", function(feature,fieldName,newFieldValue){
		     //store the updates to apply when the save button is clicked
		     updateFeature.attributes[fieldName] = newFieldValue;
		 });
    
    dojo.connect(attInspector, "onNext", function(feature){
		     updateFeature = feature;
		     console.log("Next " + updateFeature.attributes.objectid);
		 });


    map.infoWindow.setContent(attInspector.domNode);
    map.infoWindow.resize(450,300);
    
    
}

function doFind(){
    params.searchText = dojo.byId("searchText").value;
    find.execute(params, showResults);
}

function showResults(results) {
    //symbology for graphics
    var markerSymbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_SQUARE, 10, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 0, 0]), 1), new dojo.Color([0, 255, 0, 0.25]));
    var lineSymbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASH, new dojo.Color([255, 0, 0]), 1);
    var polygonSymbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_NONE, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASHDOT, new dojo.Color(["yellow"]), 2), null);

    //find results return an array of findResult.
    map.graphics.clear();
    var dataForGrid = [];
    //Build an array of attribute information and add each found graphic to the map
    dojo.forEach(results, function(result) {
		     var graphic = result.feature;
		     dataForGrid.push([result.value]);
		     switch (graphic.geometry.type) {
		     case "point":
			 graphic.setSymbol(markerSymbol);
			 break;
		     case "polyline":
			 graphic.setSymbol(lineSymbol);
			 break;
		     case "polygon":
			 graphic.setSymbol(polygonSymbol);
			 break;
		     }
		     map.graphics.add(graphic);
		 });
    var data = {
        items: dataForGrid
    };
    var store = new dojo.data.ItemFileReadStore({
						    data: data
						});
    grid.setStore(store);
}

function onRowClickHandler(evt){
    var clickedApnId = grid.getItem(evt.rowIndex).OBJECTID;
    var selectedApn;
    
    dojo.forEach(map.graphics.graphics, function(graphic){
		 if((graphic.attributes) && graphic.attributes.OBJECTID === clickedApnId){
		     selectedApn = graphic;
		     return;
		 }
		 });
    var apnExtent = selectedApn.geometry.getExtent();
    map.setExtent(apnExtent);
}

dojo.addOnLoad(init);