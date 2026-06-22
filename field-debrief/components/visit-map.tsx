'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getDistrictCentroid, jitterCentroid } from '@/lib/district-centroids'

export type MapPin = {
  id: string
  visit_date: string
  program_area: string
  location_name: string
  district: string
  nudge_flag: string | null
  sentiment: string | null
  summary: string | null
}

const FLAG_COLOR: Record<string, string> = {
  'Routine':         '#2D4A3E',
  'Needs Attention': '#B45309',
  'Escalate':        '#991B1B',
}
const DEFAULT_COLOR = '#6B7C74' // pending / no debrief yet

// Karnataka's approximate bounding center — used as the map's initial view.
const KARNATAKA_CENTER: [number, number] = [14.5204, 75.7224]

function pinIcon(color: string, isEscalate: boolean): L.DivIcon {
  return L.divIcon({
    className: 'visit-pin',
    html: `
      <div style="
        width: 18px; height: 18px;
        background: ${color};
        border: 2px solid #FDFAF5;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        ${isEscalate ? 'animation: pin-pulse 1.6s infinite;' : ''}
      "></div>
      ${isEscalate ? `<style>
        @keyframes pin-pulse {
          0%, 100% { box-shadow: 0 1px 4px rgba(0,0,0,0.35), 0 0 0 0 rgba(153,27,27,0.5); }
          50% { box-shadow: 0 1px 4px rgba(0,0,0,0.35), 0 0 0 6px rgba(153,27,27,0); }
        }
      </style>` : ''}
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -18],
  })
}

export default function VisitMap({ pins }: { pins: MapPin[] }) {
  return (
    <MapContainer
      center={KARNATAKA_CENTER}
      zoom={7}
      style={{ width: '100%', height: '100%', borderRadius: '1rem' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map(pin => {
        const centroid = getDistrictCentroid(pin.district)
        const position = jitterCentroid(centroid, pin.id)
        const color = pin.nudge_flag ? (FLAG_COLOR[pin.nudge_flag] ?? DEFAULT_COLOR) : DEFAULT_COLOR
        const isEscalate = pin.nudge_flag === 'Escalate'

        return (
          <Marker
            key={pin.id}
            position={[position.lat, position.lng]}
            icon={pinIcon(color, isEscalate)}
          >
            <Popup>
              <div style={{ minWidth: '180px', fontFamily: 'inherit' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                  {pin.location_name}
                </p>
                <p style={{ fontSize: '0.72rem', color: '#6B7C74', marginBottom: '0.4rem' }}>
                  {pin.district} · {new Date(pin.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {pin.program_area}
                </p>
                {pin.nudge_flag && (
                  <span style={{
                    display: 'inline-block', fontSize: '0.68rem', fontWeight: 600,
                    padding: '0.15rem 0.5rem', borderRadius: '99px',
                    background: color, color: '#FDFAF5', marginBottom: '0.4rem',
                  }}>
                    {pin.nudge_flag}
                  </span>
                )}
                {pin.summary && (
                  <p style={{ fontSize: '0.75rem', lineHeight: 1.4, color: '#1E2A22' }}>
                    {pin.summary.length > 140 ? pin.summary.slice(0, 140) + '…' : pin.summary}
                  </p>
                )}
                <a
                  href={`/visits/${pin.id}`}
                  style={{ display: 'inline-block', marginTop: '0.4rem', fontSize: '0.72rem', fontWeight: 600, color: '#B5521B' }}
                >
                  View visit →
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}