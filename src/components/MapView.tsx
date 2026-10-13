import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { JobSearchItem } from '../types';

interface MapViewProps {
  jobs: JobSearchItem[];
  onSelectJob: (refnr: string) => void;
}

const GERMANY_CENTER: L.LatLngTuple = [51.1657, 10.4515];

function coordsOf(job: JobSearchItem): L.LatLngTuple | null {
  const loc = job.stellenlokationen?.[0];
  if (typeof loc?.breite === 'number' && typeof loc.laenge === 'number') return [loc.breite, loc.laenge];
  return null;
}

/** Popup content is built from DOM nodes (not HTML strings) so job titles can never inject markup. */
function buildPopup(job: JobSearchItem, onSelect: (refnr: string) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'map-popup';

  const title = document.createElement('strong');
  title.textContent = job.stellenangebotsTitel || job.hauptberuf || 'Ausbildung';
  root.appendChild(title);

  if (job.firma) {
    const company = document.createElement('span');
    company.textContent = job.firma;
    root.appendChild(company);
  }

  const place = job.stellenlokationen?.[0]?.adresse;
  const where = [place?.plz, place?.ort].filter(Boolean).join(' ');
  if (where) {
    const loc = document.createElement('span');
    loc.className = 'map-popup-muted';
    loc.textContent = where;
    root.appendChild(loc);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-popup-btn';
  button.textContent = 'Details ansehen';
  button.addEventListener('click', () => onSelect(job.referenznummer));
  root.appendChild(button);

  return root;
}

export default function MapView({ jobs, onSelectJob }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectJob);

  useEffect(() => {
    onSelectRef.current = onSelectJob;
  }, [onSelectJob]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: GERMANY_CENTER, zoom: 6, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const points: L.LatLngTuple[] = [];

    for (const job of jobs) {
      const at = coordsOf(job);
      if (!at) continue;
      points.push(at);
      L.circleMarker(at, {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: '#0f766e',
        fillOpacity: 0.95,
      })
        .bindPopup(() => buildPopup(job, (refnr) => onSelectRef.current(refnr)), { minWidth: 200, maxWidth: 260 })
        .addTo(layer);
    }

    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 12 });
    // Leaflet measures its container once; re-measure after layout settles
    requestAnimationFrame(() => map.invalidateSize());
  }, [jobs]);

  return <div ref={containerRef} className="map-view" role="region" aria-label="Karte der Ausbildungsplätze" />;
}
