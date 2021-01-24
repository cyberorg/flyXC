import { LatLonZ, RuntimeTrack } from 'flyxc/common/src/runtime-track';
import { customElement, internalProperty, LitElement, property, PropertyValues } from 'lit-element';
import { connect } from 'pwa-helpers';

import { AspAt, AspMapType, AspZoomMapType, MAX_ASP_TILE_ZOOM } from '../../logic/airspaces';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

@customElement('airspace-element')
export class AirspaceElement extends connect(store)(LitElement) {
  // Actual type is google.maps.Map.
  @property({ attribute: false })
  map: any;

  private get gMap(): google.maps.Map {
    return this.map;
  }

  @internalProperty()
  private show = false;
  @internalProperty()
  private airspacesOnGraph: string[] = [];
  @internalProperty()
  private maxAltitude = 1000;
  // Whether to display restricted airspaces.
  @internalProperty()
  private showRestricted = true;
  @internalProperty()
  private track?: RuntimeTrack;

  private overlays: AspMapType[] = [];
  private info?: google.maps.InfoWindow;
  private zoomListener?: google.maps.MapsEventListener;
  private clickListener?: google.maps.MapsEventListener;
  private timestamp = 0;

  connectedCallback(): void {
    super.connectedCallback();
    // Add the overlays for different zoom levels.
    this.overlays = [new AspMapType(this.maxAltitude, MAX_ASP_TILE_ZOOM)];
    for (let zoom = MAX_ASP_TILE_ZOOM + 1; zoom <= 17; zoom++) {
      this.overlays.push(new AspZoomMapType(this.maxAltitude, MAX_ASP_TILE_ZOOM, zoom));
    }
    this.setOverlaysZoom();
    this.info = new google.maps.InfoWindow({ disableAutoPan: true });
    this.info.close();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.overlays.length = 0;
    this.info = undefined;
  }

  stateChanged(state: RootState): void {
    this.show = state.airspace.show;
    this.showRestricted = state.airspace.showRestricted;
    this.maxAltitude = state.airspace.maxAltitude;
    this.track = sel.currentTrack(state);
    this.timestamp = state.app.timestamp;
    this.airspacesOnGraph = state.airspace.onGraph;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.show) {
      // Need to remove and re-add the overlays to change the altitude / restricted visibility.
      if (changedProperties.has('maxAltitude') || changedProperties.has('showRestricted')) {
        this.removeOverlays();
        this.addOverlays();
      }
      // The airspacesOnGraph property gets updated from the graph each time the cursor moves.
      if (this.track && changedProperties.has('airspacesOnGraph')) {
        if (this.airspacesOnGraph.length) {
          const { lat, lon } = sel.getTrackLatLonAlt(store.getState())(this.timestamp) as LatLonZ;
          this.info?.setContent(this.airspacesOnGraph.map((t) => `<b>${t}</b>`).join('<br>'));
          this.info?.setPosition({ lat, lng: lon });
          this.info?.open(this.gMap);
        } else {
          this.info?.close();
        }
      }
    }
    if (changedProperties.has('show')) {
      if (this.show) {
        this.addOverlays();
        this.clickListener = this.gMap.addListener('click', (e): void => this.handleMapClick(e.latLng));
        this.zoomListener = this.gMap.addListener('zoom_changed', () => this.setOverlaysZoom());
      } else {
        this.removeOverlays();
        this.info?.close();
        this.clickListener?.remove();
        this.zoomListener?.remove();
      }
    }
    // Nothing to render.
    return false;
  }

  private handleMapClick(latLng: google.maps.LatLng): void {
    if (this.show) {
      this.info?.close();
      const html = AspAt(
        this.gMap.getZoom(),
        { lat: latLng.lat(), lon: latLng.lng() },
        this.maxAltitude,
        this.showRestricted,
      );
      if (html) {
        this.info?.setContent(html);
        this.info?.setPosition(latLng);
        this.info?.open(this.gMap);
      }
    }
  }

  private addOverlays(): void {
    this.overlays.forEach((o) => {
      if (this.gMap.overlayMapTypes) {
        o.setAltitude(this.maxAltitude);
        o.setShowRestricted(this.showRestricted);
        this.gMap.overlayMapTypes.push(o);
      }
    });
  }

  private removeOverlays(): void {
    for (let i = this.gMap.overlayMapTypes.getLength() - 1; i >= 0; i--) {
      const o = this.gMap.overlayMapTypes.getAt(i);
      if (o instanceof AspMapType || o instanceof AspZoomMapType) {
        this.gMap.overlayMapTypes.removeAt(i);
      }
    }
  }

  // Broadcast the current zoom level to the overlays so that they know when they are active.
  private setOverlaysZoom(): void {
    const zoom = this.gMap.getZoom();
    this.overlays.forEach((overlay) => overlay.setCurrentZoom(zoom));
  }

  protected createRenderRoot(): Element {
    return this;
  }
}
