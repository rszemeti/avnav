/**
 * Created by andreas on 14.07.14.
 */

import keys,{KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import RouteEdit from '../nav/routeeditor.js';
import orangeMarker from '../images/MarkerOrange.png';
import NavCompute from "../nav/navcompute";

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);
const editingRoute=new RouteEdit(RouteEdit.MODES.EDIT,true);
class RouteDisplay{
    constructor(mapholder) {
        this.mapholder=mapholder;
        this.points=[];
        this.segments=[];
        this.filled=false;
        this.targetIndex=undefined;
    }
    reset(){
        this.points=[];
        this.segments=[];
        this.filled=false;
        this.targetIndex=undefined;
    }
    fillIfNeeded(routePoints,opt_target){
        if (this.filled) return;
        this.points=[];
        this.segments=[];
        let lastPoint=undefined;
        this.targetIndex=undefined;
        for (let i in routePoints){
            if (!routePoints[i]) continue;
            if (opt_target !== undefined && routePoints[i].compare(opt_target)){
                this.targetIndex=i;
            }
            let p = this.mapholder.pointToMap(routePoints[i].toCoord());
            this.points.push(p);
            if (lastPoint !== undefined) {
                if (globalStore.getData(keys.nav.routeHandler.useRhumbLine)) {
                    this.segments.push([this.mapholder.pointToMap(lastPoint.toCoord()),p]);
                } else {
                    let nextPart=[];
                    let segments = NavCompute.computeCoursePoints(lastPoint, routePoints[i], 3);
                    for (let s in segments) {
                        nextPart.push(this.mapholder.pointToMap([segments[s].lon, segments[s].lat]));
                    }
                    this.segments.push(nextPart);
                }
            }
            lastPoint = routePoints[i];
        }
        this.filled=true;
    }
    getPoints(){
        return this.points;
    }
    getSegments(){
        return this.segments;
    }
    getTargetIndex(){
        return this.targetIndex;
    }
}
/**
 * a cover for the layer with routing data
 * @param {MapHolder} mapholder
 * @constructor
 */
const RouteLayer=function(mapholder){
    /**
     * @private
     * @type {MapHolder}
     */
    this.mapholder=mapholder;

    /**
     * @private
     * @type {boolean}
     */
    this.visible=globalStore.getData(keys.properties.layers.nav);
    /**
     * the pixel coordinates of the route points from the last draw
     * @private
     * @type {Array}
     */
    this.routePixel=[];
    /**
     * the list of pixel coordinates for waypoints
     * currently only one element
     * @type {Array}
     */
    this.wpPixel=[];
    /**
     * @private
     * @type {string}
     */
    this._routeName=undefined;

    /**
     * decide whether we should show the editing route or the active
     * @type {boolean}
     * @private
     */
    this._displayEditing=false;

    /**
     * @private
     * @type {olStyle}
     */
    this.lineStyle={};
    this.activeWpStyle={};
    this.normalWpStyle={};
    this.routeTargetStyle={};
    this.markerStyle={};
    this.courseStyle={};
    this.textStyle={};
    this.dashedStyle={};
    this.setStyle();
    let navStoreKeys=[keys.nav.gps.position,keys.nav.gps.valid];
    navStoreKeys=navStoreKeys.concat(
        KeyHelper.flattenedKeys(activeRoute.getStoreKeys()),
        KeyHelper.flattenedKeys(editingRoute.getStoreKeys())
    );
    globalStore.register(()=>this.mapholder.triggerRender(),navStoreKeys);
    globalStore.register(this,keys.gui.global.propertySequence);
    this.routeDisplay=new RouteDisplay(this.mapholder);
    this.currentCourse=new RouteDisplay(this.mapholder);
    globalStore.register(()=>{
        this.routeDisplay.reset();
        this.currentCourse.reset();
    },activeRoute.getStoreKeys(editingRoute.getStoreKeys({seq: keys.gui.global.propertySequence,rl:keys.nav.routeHandler.useRhumbLine})));
    globalStore.register(()=>{
        this.currentCourse.reset();
    },activeRoute.getStoreKeys({lat:keys.nav.gps.lat,lon:keys.nav.gps.lon,
        seq:keys.gui.global.propertySequence,
        rl:keys.nav.routeHandler.useRhumbLine}));
    this.currentLeg=new RouteDisplay(this.mapholder);
    globalStore.register(()=>{
        this.currentLeg.reset();
    },activeRoute.getStoreKeys({seq:keys.gui.global.propertySequence,rl:keys.nav.routeHandler.useRhumbLine}))
    /**
     * drag overlay state for visual feedback during route point dragging
     * @type {{index: number, mapPoint: Array}|null}
     * @private
     */
    this._dragOverlay=null;

    /**
     * long press preview state for animated growing dot
     * @type {{mapPoint: Array, progress: number}|null}
     * @private
     */
    this._longPressPreview=null;


};

export const getRouteStyles=(opt_change)=>{
    let rt={};
    rt.lineStyle = {
        color:  globalStore.getData(keys.properties.routeColor),
        width:  globalStore.getData(keys.properties.routeWidth),
        arrow: {
            width:  globalStore.getData(keys.properties.routeWidth)*3,
            length:  globalStore.getData(keys.properties.routeWidth)*7,
            offset: 20,
            open: true
        }
    };
    rt.dashedStyle = {
        color:  globalStore.getData(keys.properties.routeColor),
        width:  globalStore.getData(keys.properties.routeWidth),
        dashed: true
    };
    rt.normalWpStyle={
        color: "yellow",
        width: 1,
        background: "yellow"
    };
    rt.activeWpStyle={
        color: "red",
        width: 1,
        background: "red"
    };
    rt.routeTargetStyle={
        color:  globalStore.getData(keys.properties.bearingColor),
        width: 1,
        background:  globalStore.getData(keys.properties.bearingColor)
    };
    if (! opt_change) {
        rt.markerStyle = {
            anchor: [20, 20],
            size: [40, 40],
            src: orangeMarker,
            image: new Image()
        };
        rt.markerStyle.image.src = rt.markerStyle.src;
    }
    rt.courseStyle = {
        color:  globalStore.getData(keys.properties.bearingColor),
        width:  globalStore.getData(keys.properties.bearingWidth)

    };
    rt.textStyle= {
        stroke: globalStore.getData(keys.properties.fontShadowColor),
        color: globalStore.getData(keys.properties.fontColor),
        width: globalStore.getData(keys.properties.fontShadowWidth),
        fontSize: globalStore.getData(keys.properties.routingTextSize),
        fontBase: globalStore.getData(keys.properties.fontBase),
        offsetY: 15
    };
    return rt;
}

/**
 * set the styles
 * @private
 */
RouteLayer.prototype.setStyle=function(opt_change) {
    const styles=getRouteStyles(opt_change);
    Object.assign(this,styles);
};


RouteLayer.prototype.showEditingRoute=function(on){
    let old=this._displayEditing;
    this._displayEditing=on;
    if (on != old){
        this.routeDisplay.reset();
        this.currentCourse.reset();
        this.mapholder.triggerRender();
    }
};

/**
 *
 * @param {olCoordinate} center
 * @param {Drawing} drawing
 */
RouteLayer.prototype.onPostCompose=function(center,drawing) {
    this.routePixel = [];
    this.wpPixel=[];
    if (!this.visible) return;
    let currentEditor=this._displayEditing?editingRoute:activeRoute;
    let showingActive= ! this._displayEditing || currentEditor.isActiveRoute();
    let gpsPosition=globalStore.getData(keys.nav.gps.position);
    let gpsValid=globalStore.getData(keys.nav.gps.valid);
    let toPoint=showingActive?activeRoute.getCurrentTarget():undefined;
    let fromPoint=showingActive?activeRoute.getCurrentFrom():undefined;
    let showBoat=globalStore.getData(keys.properties.layers.boat);
    let showNav=globalStore.getData(keys.properties.layers.nav);
    let wpSize=globalStore.getData(keys.properties.routeWpSize);
    let drawNav=showBoat&&showNav;
    let route=currentEditor.getRoute();
    let text,wp;
    if (! drawNav ) {
        this.routePixel=[];
        return;
    }
    if (fromPoint && toPoint && gpsValid ){
        this.currentCourse.fillIfNeeded([gpsPosition,toPoint])
        let line=this.currentCourse.getSegments()[0];
        drawing.drawLineToContext(line,this.courseStyle);
        if (fromPoint){
            this.currentLeg.fillIfNeeded([fromPoint,toPoint]);
            line=this.currentLeg.getSegments()[0];
            drawing.drawLineToContext(line,this.dashedStyle);
        }
    }
    if (toPoint && ! route ){
        let to=this.mapholder.pointToMap(toPoint.toCoord());
        //only draw the current target wp if we do not have a route
        this.wpPixel.push(drawing.drawImageToContext(to,this.markerStyle.image,this.markerStyle));
        if (toPoint.name){
            drawing.drawTextToContext(to,toPoint.name,this.textStyle);
        }
    }
    if ( route) {
        this.routeDisplay.fillIfNeeded(route.points,toPoint);
        let routeTarget=this.routeDisplay.getTargetIndex();
        this.routePixel=[];
        let allSegments=this.routeDisplay.getSegments();
        let currentRoutePoints=this.routeDisplay.getPoints();
        // build adjusted points array if dragging
        let adjustedPoints = currentRoutePoints;
        if (this._dragOverlay && this._dragOverlay.index >= 0 && this._dragOverlay.index < currentRoutePoints.length) {
            adjustedPoints = currentRoutePoints.slice();
            adjustedPoints[this._dragOverlay.index] = this._dragOverlay.mapPoint;
        }
        // draw segments, replacing those adjacent to dragged point with straight lines
        for (let i = 0; i < allSegments.length; i++){
            if (this._dragOverlay && (i === this._dragOverlay.index - 1 || i === this._dragOverlay.index)) {
                // draw a straight line using adjusted endpoints
                drawing.drawLineToContext([adjustedPoints[i], adjustedPoints[i + 1]], this.lineStyle);
            } else {
                drawing.drawLineToContext(allSegments[i], this.lineStyle);
            }
        }
        let active = currentEditor.getIndex();
        let i,style;
        for (i = 0; i < currentRoutePoints.length; i++) {
            let drawPoint=currentRoutePoints[i];
            style=this.normalWpStyle;
            if (i == active) style=this.activeWpStyle;
            else {
                if (i == routeTarget) style=this.routeTargetStyle;
            }
            if (this._dragOverlay && this._dragOverlay.index === i) {
                drawPoint=this._dragOverlay.mapPoint;
                style={color: "white", width: 2, background: "rgba(255,0,0,0.6)"};
            }
            this.routePixel.push(drawing.drawBubbleToContext(drawPoint,wpSize,style));
            wp=route.points[i];
            if (wp && wp.name) text=wp.name;
            else text=i+"";
            drawing.drawTextToContext(drawPoint,text,this.textStyle);
        }
    }
    else {
        this.routePixel=[];

    }

    // draw long-press preview (dot with clockwise progress arc)
    if (this._longPressPreview) {
        let wpSize=globalStore.getData(keys.properties.routeWpSize);
        let dotRadius = wpSize * 4;
        let progress = this._longPressPreview.progress;
        let ctx = drawing.context;
        if (ctx) {
            let cp = drawing.pointToCssPixel(this._longPressPreview.mapPoint);
            cp = drawing.pixelToDevice(cp);
            let r = dotRadius * drawing.devPixelRatio;
            let arcGap = 4 * drawing.devPixelRatio;
            let arcR = r + arcGap;
            let arcWidth = 3 * drawing.devPixelRatio;
            ctx.save();
            // filled dot
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(cp[0], cp[1], r, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(255,200,0,0.7)";
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,0,0.9)";
            ctx.lineWidth = 2 * drawing.devPixelRatio;
            ctx.stroke();
            // clockwise progress arc (12 o'clock = -PI/2)
            if (progress > 0) {
                let startAngle = -Math.PI / 2;
                let endAngle = startAngle + 2 * Math.PI * progress;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(cp[0], cp[1], arcR, startAngle, endAngle);
                ctx.strokeStyle = "rgba(255,40,40,0.95)";
                ctx.lineWidth = arcWidth * 2;
                ctx.lineCap = "round";
                ctx.stroke();
            }
            ctx.restore();
        }
    }

};
/**
 * find the waypoint that has been clicked and set this as active
 * @param pixel
 * @returns {navobjects.WayPoint} or undefined
 */
RouteLayer.prototype.findTarget=function(pixel){
    //TODO: own tolerance
    let tolerance=globalStore.getData(keys.properties.clickTolerance)/2;
    let currentEditor=this._displayEditing?editingRoute:activeRoute;
    if (this.routePixel) {
        let idx = this.mapholder.findTargets(pixel, this.routePixel, tolerance);
        if (idx.length > 0) {
            return currentEditor.getPointAt(idx[0]);
        }
    }
    if (this.wpPixel) {
        let idx = this.mapholder.findTargets(pixel, this.wpPixel, tolerance);
        if (idx.length> 0) {
            return currentEditor.getCurrentTarget();
        }
    }
    return undefined;
};
/**
 * find a route waypoint at the given pixel and return both index and waypoint
 * @param pixel
 * @returns {{index: number, waypoint: navobjects.WayPoint}|null}
 */
RouteLayer.prototype.findTargetWithIndex=function(pixel){
    let tolerance=globalStore.getData(keys.properties.clickTolerance)/2;
    let currentEditor=this._displayEditing?editingRoute:activeRoute;
    if (this.routePixel) {
        let idx = this.mapholder.findTargets(pixel, this.routePixel, tolerance);
        if (idx.length > 0) {
            return {index: idx[0], waypoint: currentEditor.getPointAt(idx[0])};
        }
    }
    return null;
};
RouteLayer.prototype.getWaypointAt=function(index){
    let currentEditor=this._displayEditing?editingRoute:activeRoute;
    return currentEditor.getPointAt(index);
};
/**
 * find the nearest route segment to a pixel location
 * @param {Array} pixel - screen pixel [x, y]
 * @returns {{segmentIndex: number}|null} segmentIndex is the index of the first point of the segment
 */
RouteLayer.prototype.findNearestSegment=function(pixel){
    let tolerance=globalStore.getData(keys.properties.clickTolerance)/2;
    if (!this.routePixel || this.routePixel.length < 2) return null;
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < this.routePixel.length - 1; i++) {
        let p1 = this.routePixel[i];
        let p2 = this.routePixel[i + 1];
        if (!p1 || !p2) continue;
        let dist = this._pointToSegmentDist(pixel, p1, p2);
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    }
    if (bestIdx >= 0 && bestDist <= tolerance) {
        return {segmentIndex: bestIdx};
    }
    return null;
};
/**
 * compute distance from point to line segment
 * @private
 */
RouteLayer.prototype._pointToSegmentDist=function(p, a, b){
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    let lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        dx = p[0] - a[0];
        dy = p[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
    }
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    let projX = a[0] + t * dx;
    let projY = a[1] + t * dy;
    dx = p[0] - projX;
    dy = p[1] - projY;
    return Math.sqrt(dx * dx + dy * dy);
};
/**
 * set drag overlay to show a route point at a temporary position during drag
 * @param {number} index - the route point index being dragged
 * @param {Array} mapPoint - the current map coordinates of the drag position
 */
RouteLayer.prototype.setDragOverlay=function(index, mapPoint){
    this._dragOverlay={index: index, mapPoint: mapPoint};
    this.mapholder.triggerRender();
};
/**
 * clear the drag overlay
 */
RouteLayer.prototype.clearDragOverlay=function(){
    this._dragOverlay=null;
    this.mapholder.triggerRender();
};
/**
 * set long-press preview to show a growing dot at the press location
 * @param {Array} mapPoint - map coordinates
 * @param {number} progress - 0 to 1
 */
RouteLayer.prototype.setLongPressPreview=function(mapPoint, progress){
    this._longPressPreview={mapPoint: mapPoint, progress: Math.min(1, Math.max(0, progress))};
    this.mapholder.triggerRender();
};
/**
 * clear the long-press preview
 */
RouteLayer.prototype.clearLongPressPreview=function(){
    this._longPressPreview=null;
    this.mapholder.triggerRender();
};
RouteLayer.prototype.dataChanged=function() {
    this.visible=globalStore.getData(keys.properties.layers.nav);
    this.setStyle(true);
    this.mapholder.triggerRender();
};
RouteLayer.prototype.setImageStyles=function(styles){
    let markerStyle=styles.markerImage;
    if (typeof(markerStyle) === 'object'){
        if (markerStyle.src) {
            this.markerStyle.src=markerStyle.src;
            this.markerStyle.image.src=markerStyle.src;
        }
        if (markerStyle.size) this.markerStyle.size=markerStyle.size;
        if (markerStyle.anchor) this.markerStyle.anchor=markerStyle.anchor;
    }

};

export default RouteLayer;
