import './pref-modal';
import './track-modal';
import './about-modal';

import { customElement, html, internalProperty, LitElement, TemplateResult } from 'lit-element';
import { UnsubscribeHandle } from 'micro-typed-events';
import { connect } from 'pwa-helpers';

import { menuController, modalController } from '@ionic/core';

import { addUrlParamValues, ParamNames, pushCurrentState } from '../../logic/history';
import * as msg from '../../logic/messages';
import { uploadTracks } from '../../logic/track';
import { DistanceUnit, formatUnit } from '../../logic/units';
import * as airspaces from '../../redux/airspace-slice';
import * as airways from '../../redux/airways-slice';
import { setDisplayLiveNames, setDisplayNames, setView3d } from '../../redux/app-slice';
import { setAltitudeMultiplier } from '../../redux/arcgis-slice';
import { setReturnUrl } from '../../redux/live-track-slice';
import { setEnabled } from '../../redux/planner-slice';
import * as sel from '../../redux/selectors';
import { RootState, store } from '../../redux/store';

@customElement('main-menu')
export class MainMenu extends connect(store)(LitElement) {
  @internalProperty()
  view3d = false;

  @internalProperty()
  exaggeration = 1;

  @internalProperty()
  plannerEnabled = false;

  stateChanged(state: RootState): void {
    this.view3d = state.app.view3d;
    this.exaggeration = state.arcgis.altMultiplier;
    this.plannerEnabled = state.planner.enabled;
  }

  render(): TemplateResult {
    return html`<style>
        ion-item i.las {
          margin-right: 10px;
        }
        .about-alert {
          --max-width: 350px;
        }
      </style>
      <ion-menu side="end" type="overlay" swipe-gesture="false" menu-id="main" content-id="main">
        <ion-header>
          <ion-toolbar color="light">
            <ion-title>FlyXC.app</ion-title>
            <ion-buttons slot="end">
              <ion-menu-button><i class="las la-times"></i></ion-menu-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list>
            <view-items></view-items>
            <track-items></track-items>
            <live-items></live-items>
            ${!this.view3d
              ? html`<ion-item button @click=${this.handlePlanner}>
                  <i class="las la-drafting-compass la-2x"></i>XC planning
                  <ion-toggle slot="end" .checked=${this.plannerEnabled}></ion-toggle>
                </ion-item>`
              : null}
            ${!this.view3d ? html`` : null} ${!this.view3d ? html`<airspace-items></airspace-items>` : null}
            ${!this.view3d ? html`<airways-items></airways-items>` : null}
            ${this.view3d
              ? html`<ion-item lines="none"><i class="las la-mountain la-2x"></i>Altitude exaggeration</ion-item>
                  <ion-item @ionChange=${this.handleExaggeration}>
                    <ion-range min="1" max="2.6" step="0.2" debounce="50" value=${this.exaggeration}>
                      <ion-label slot="start">1.0x</ion-label>
                      <ion-label slot="end">2.6x</ion-label>
                    </ion-range>
                  </ion-item>`
              : null}
            <fullscreen-items></fullscreen-items>
            <ion-item button @click=${this.handlePreferences} lines="full">
              <i class="las la-cog la-2x"></i>Preferences
            </ion-item>
            <ion-item button @click=${this.handleAbout} lines="full"> <i class="las la-info la-2x"></i>About </ion-item>
          </ion-list>
        </ion-content>
      </ion-menu>`;
  }

  protected createRenderRoot(): Element {
    return this;
  }

  private handlePlanner() {
    if (!this.plannerEnabled) {
      // TODO: better way
      menuController.close();
    }
    store.dispatch(setEnabled(!this.plannerEnabled));
  }

  private async handleAbout() {
    const modal = await modalController.create({
      component: 'about-modal',
    });
    await modal.present();
  }

  private async handlePreferences() {
    const modal = await modalController.create({
      component: 'pref-modal',
    });
    await modal.present();
  }

  private handleExaggeration(e: CustomEvent) {
    store.dispatch(setAltitudeMultiplier(Number(e.detail.value ?? 1)));
  }
}

@customElement('airspace-items')
export class AirspaceItems extends connect(store)(LitElement) {
  @internalProperty()
  unit?: DistanceUnit;
  @internalProperty()
  private maxAltitude = 1000;
  @internalProperty()
  private altitudeStops: number[] = [];
  @internalProperty()
  private showRestricted = true;
  @internalProperty()
  private show = false;

  private subscriptions: UnsubscribeHandle[] = [];

  stateChanged(state: RootState): void {
    this.unit = state.units.altitude;
    this.maxAltitude = state.airspace.maxAltitude;
    this.altitudeStops = sel.airspaceAltitudeStops(state);
    this.showRestricted = state.airspace.showRestricted;
    this.show = state.airspace.show;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.subscriptions.push(
      msg.trackGroupsAdded.subscribe(() => this.updateMaxAltitude()),
      msg.trackGroupsRemoved.subscribe(() => this.updateMaxAltitude()),
    );
    this.updateMaxAltitude();
  }

  disconnectedCallback(): void {
    this.subscriptions.forEach((sub) => sub());
    this.subscriptions.length = 0;
  }

  render(): TemplateResult {
    return html`<ion-item lines="none" button @click=${this.handleShow}>
        <i class="las la-fighter-jet la-2x"></i>Airspaces
        <ion-toggle slot="end" .checked=${this.show}></ion-toggle>
      </ion-item>
      <ion-item button lines="none" .disabled=${!this.show} @click=${this.handleShowRestricted}>
        <ion-label>Show E, F, G, restricted</ion-label>
        <ion-toggle slot="end" .checked=${this.showRestricted}></ion-toggle>
      </ion-item>
      <ion-item .disabled=${!this.show}>
        <ion-label position="floating">Floor below</ion-label>
        <ion-select @ionChange=${this.handleMaxAltitude} value=${this.maxAltitude} interface="popover">
          ${this.altitudeStops.map(
            (altitude: number) =>
              html`<ion-select-option value=${altitude}> ${formatUnit(altitude, this.unit)} </ion-select-option> `,
          )}
        </ion-select>
      </ion-item>`;
  }

  // Updates the altitude select with the max altitude across tracks.
  // Triggered on init and when tracks get added or removed.
  private updateMaxAltitude(): void {
    const stops = this.altitudeStops;
    if (stops.length > 0) {
      const maxAlt = sel.maxAlt(store.getState());
      this.maxAltitude = stops.find((alt) => alt >= maxAlt) ?? stops[stops.length - 1];
    }
  }

  private handleShow() {
    store.dispatch(airspaces.setShow(!this.show));
  }

  private handleShowRestricted() {
    store.dispatch(airspaces.setShowRestricted(!this.showRestricted));
  }

  private handleMaxAltitude(event: CustomEvent) {
    store.dispatch(airspaces.setMaxAltitude(event.detail.value));
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('airways-items')
export class SkywaysItems extends connect(store)(LitElement) {
  @internalProperty()
  private opacity = 100;
  @internalProperty()
  private show = false;

  stateChanged(state: RootState): void {
    this.opacity = state.airways.opacity;
    this.show = state.airways.show;
  }

  render(): TemplateResult {
    return html`<ion-item lines="none" button @click=${this.handleShow}>
        <i class="las la-road la-2x"></i>Airways
        <ion-toggle slot="end" .checked=${this.show}></ion-toggle>
      </ion-item>
      <ion-item .disabled=${!this.show} @ionChange=${this.handleOpacity}>
        <ion-range min="20" max="100" step="5" debounce="50" value=${this.opacity}>
          <ion-label slot="start"><i class="las la-adjust"></i></ion-label>
          <ion-label slot="end"><i class="las la-adjust la-2x"></i></ion-label>
        </ion-range>
      </ion-item>`;
  }

  private handleShow() {
    store.dispatch(airways.setShow(!this.show));
  }

  private handleOpacity(event: CustomEvent) {
    store.dispatch(airways.setOpacity(event.detail.value));
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('view-items')
export class ViewItems extends connect(store)(LitElement) {
  @internalProperty()
  view3d = false;

  stateChanged(state: RootState): void {
    this.view3d = state.app.view3d;
  }

  render(): TemplateResult {
    const icon = this.view3d ? 'la-map' : 'la-globe';
    return html`<ion-item button @click=${this.handleSwitch} lines="full">
      <i class=${`las la-2x ${icon}`}></i>
      Switch to ${this.view3d ? '2d' : '3d'}
    </ion-item>`;
  }

  private handleSwitch() {
    // Request the current map to update the location.
    msg.requestLocation.emit();
    pushCurrentState();
    store.dispatch(setView3d(!this.view3d));
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('fullscreen-items')
export class FullScreenItems extends connect(store)(LitElement) {
  @internalProperty()
  private fullscreen = true;

  stateChanged(state: RootState): void {
    this.fullscreen = state.browser.isFullscreen;
  }

  render(): TemplateResult {
    const icon = this.fullscreen ? 'la-compress' : 'la-expand';
    return html`<ion-item button @click=${this.handleSwitch} lines="full">
      <i class=${`las la-2x ${icon}`}></i>
      ${this.fullscreen ? 'Exit full screen' : 'Full screen'}
    </ion-item>`;
  }

  private handleSwitch() {
    const element = document.querySelector('.fs-enabled');
    if (element) {
      if (!this.fullscreen) {
        element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('track-items')
export class TrackItems extends connect(store)(LitElement) {
  @internalProperty()
  private numTracks = 0;
  @internalProperty()
  private displayName = false;

  stateChanged(state: RootState): void {
    this.numTracks = sel.numTracks(state);
    this.displayName = state.app.displayNames;
  }

  render(): TemplateResult {
    return html`<ion-item button @click=${this.forwardClick} lines="none">
        <i class="las la-route la-2x"></i>Tracks
        <ion-button slot="end" color="primary" fill="outline">
          <i class="las la-cloud-upload-alt la-2x" slot="start"></i>Upload
        </ion-button>
        <input
          type="file"
          multiple
          id="track"
          tabindex="-1"
          style="position:absolute; left: 9999px;"
          @change=${this.handleUpload}
        />
      </ion-item>
      <ion-item lines="none" button detail .disabled=${this.numTracks == 0} @click=${this.handleSelect}>
        Pilots
        <ion-badge slot="end" color="primary">${this.numTracks}</ion-badge>
      </ion-item>
      <ion-item lines="full" .disabled=${this.numTracks == 0} button @click=${this.handleDisplayNames}>
        <ion-label>Labels</ion-label>
        <ion-toggle slot="end" .checked=${this.displayName}></ion-toggle>
      </ion-item>`;
  }

  // Programmatically opens the file dialog.
  private forwardClick(): void {
    (this.renderRoot.querySelector('#track') as HTMLInputElement)?.click();
  }

  private async handleUpload(e: Event): Promise<void> {
    if (e.target) {
      const el = e.target as HTMLInputElement;
      if (el.files?.length) {
        const files: File[] = [];
        for (let i = 0; i < el.files.length; i++) {
          files.push(el.files[i]);
        }
        const ids = await uploadTracks(files);
        pushCurrentState();
        addUrlParamValues(ParamNames.groupId, ids);
        el.value = '';
      }
    }
  }

  // Shows/Hides pilot names next to the marker.
  private handleDisplayNames(): void {
    store.dispatch(setDisplayNames(!this.displayName));
  }

  private async handleSelect() {
    const modal = await modalController.create({
      component: 'track-modal',
    });
    await modal.present();
  }

  protected createRenderRoot(): Element {
    return this;
  }
}

@customElement('live-items')
export class LiveTrackItems extends connect(store)(LitElement) {
  @internalProperty()
  private displayLiveName = false;

  stateChanged(state: RootState): void {
    this.displayLiveName = state.app.displayLiveNames;
  }

  render(): TemplateResult {
    return html`<ion-item lines="none"> <i class="las la-satellite-dish la-2x"></i>Live tracks </ion-item>
      <ion-item button detail lines="none" @click=${this.handleConfig}>
        <ion-label>Configuration</ion-label>
      </ion-item>
      <ion-item lines="full" button @click=${this.handleDisplayNames}>
        <ion-label>Labels</ion-label>
        <ion-toggle slot="end" .checked=${this.displayLiveName}></ion-toggle>
      </ion-item>`;
  }

  // Shows/Hides pilot names next to the marker.
  private handleDisplayNames(): void {
    store.dispatch(setDisplayLiveNames(!this.displayLiveName));
  }

  private handleConfig() {
    store.dispatch(setReturnUrl(document.location.toString()));
    document.location.href = '/devices.html';
  }

  protected createRenderRoot(): Element {
    return this;
  }
}
