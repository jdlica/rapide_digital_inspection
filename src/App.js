import React from 'react';
import './style.css';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import carMakeData from './data/car_make.json';
import carModelData from './data/car_model.json';
import municipalitiesData from './data/municipalities_calabarzon.json';
import barangaysData from './data/barangays_calabarzon.json';
import ncrData from './data/ncr_cities_barangays.json';
import partsData from './data/parts.json';
import fleetData from './data/Fleet.json';
import serviceComplaintsData from './data/service_complaints.json';

// ============================================================
// RAPIDE DIGITAL INSPECTION SYSTEM
// ============================================================

// --- BRAND COLORS ---
const BRAND = {
  yellow: '#FFD100',
  yellowLight: '#FFF3B0',
  yellowPale: '#FFFBE6',
  black: '#1A1A1A',
  red: '#E31E24',
  green: '#22C55E',
  greenBg: '#DCFCE7',
  yellowStatus: '#F59E0B',
  yellowStatusBg: '#FEF3C7',
  redBg: '#FEE2E2',
  gray: '#6B7280',
  grayLight: '#F3F4F6',
  grayBorder: '#D1D5DB',
  white: '#FFFFFF',
};

// --- MASTER DATA (derived from car_make.json + car_model.json) ---
const _makeIdToName = {};
for (const m of carMakeData) _makeIdToName[m.id] = m.name;

const _modelsMap = {};
for (const m of carMakeData) _modelsMap[m.name] = new Set();
for (const m of carModelData) {
  const makeName = _makeIdToName[m.make_id];
  if (makeName) _modelsMap[makeName].add(m.name);
}
const CAR_BRANDS = [...Object.keys(_modelsMap).sort(), 'Others'];
const CAR_MODELS = Object.fromEntries(
  Object.entries(_modelsMap).map(([make, set]) => [make, [...set].sort()])
);

const REPLACED_PARTS = [...new Set(partsData)].sort();

// --- PHILIPPINES LOCATION DATA (provinces + municipalities + barangays) ---

// Step 1: province_id -> province_name (CALABARZON region)
const _provinceMap = {
  18: 'Batangas',
  19: 'Cavite',
  20: 'Laguna',
  21: 'Quezon',
  22: 'Rizal',
};

// Step 2: count how many municipalities share the same name (for disambiguation)
const _nameCount = {};
for (const m of municipalitiesData) {
  _nameCount[m.municipality_name] = (_nameCount[m.municipality_name] || 0) + 1;
}

// Step 3: municipality_id -> barangay names
const _barangaysByMunId = {};
for (const b of barangaysData) {
  if (!_barangaysByMunId[b.municipality_id]) _barangaysByMunId[b.municipality_id] = [];
  _barangaysByMunId[b.municipality_id].push(b.barangay_name);
}

// Step 4: build display name -> sorted barangays
// Duplicate names get ", Province" appended (e.g. "San Miguel, Bulacan")
const _barangaysByMunicipality = {};
for (const m of municipalitiesData) {
  const displayName =
    _nameCount[m.municipality_name] > 1
      ? `${m.municipality_name}, ${_provinceMap[m.province_id] || ''}`
      : m.municipality_name;
  const barangays = _barangaysByMunId[m.municipality_id] || [];
  if (!_barangaysByMunicipality[displayName]) {
    _barangaysByMunicipality[displayName] = new Set();
  }
  for (const b of barangays) _barangaysByMunicipality[displayName].add(b);
}

// Convert sets to sorted arrays
for (const name of Object.keys(_barangaysByMunicipality)) {
  _barangaysByMunicipality[name] = [..._barangaysByMunicipality[name]].sort();
}

// Merge NCR cities and barangays (no duplication — skip if name already exists)
// Some cities (e.g. Manila) use a `districts` array instead of a flat `barangays` array.
for (const city of ncrData.cities) {
  if (!_barangaysByMunicipality[city.name]) {
    let barangays = [];
    if (Array.isArray(city.barangays)) {
      barangays = city.barangays;
    } else if (Array.isArray(city.districts)) {
      for (const district of city.districts) {
        if (Array.isArray(district.barangays)) barangays.push(...district.barangays);
      }
    }
    _barangaysByMunicipality[city.name] = [...barangays].sort();
  }
}

// All locations sorted — CALABARZON + NCR, with Others at the end
const MUNICIPALITY_LIST = [...Object.keys(_barangaysByMunicipality).sort(), 'Others'];


const DECLINE_REASONS = [
  'No budget',
  'Will return later',
  'Needs approval',
  'No time',
  'Already has mechanic',
  'Monitor first',
  'No stock',
  'Other',
];

const YEARS = Array.from({ length: 35 }, (_, i) => (2026 - i).toString());
const KM_READINGS = Array.from({ length: 301 }, (_, i) =>
  (i * 1000).toString()
);

// --- INSPECTION DATA PER PACKAGE ---
const INSPECTION_DATA = {
  quick: [
    {
      category: 'BATTERY TEST',
      items: [
        {
          name: 'Battery Voltage',
          conditions: [
            { label: '12.6V – 12.8V', color: 'green', action: 'Good' },
            { label: '12.2V – 12.6V', color: 'yellow', action: 'Recharge' },
            { label: '<12.2V', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Starting Power (CCA)',
          conditions: [
            { label: '>80%', color: 'green', action: 'Good' },
            { label: '<80%', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
    {
      category: 'UNDER THE HOOD',
      items: [
        {
          name: 'Coolant Level',
          conditions: [
            { label: 'Correct Level', color: 'green', action: 'Good' },
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          ],
        },
        {
          name: 'Brake Fluid Level',
          conditions: [
            { label: 'Correct Level', color: 'green', action: 'Good' },
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          ],
        },
        {
          name: 'Power Steering Fluid',
          conditions: [
            { label: 'Correct Level', color: 'green', action: 'Good' },
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          ],
        },
        {
          name: 'Clutch Fluid',
          conditions: [
            { label: 'Correct Level', color: 'green', action: 'Good' },
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          ],
        },
      ],
    },
    {
      category: 'TIRES',
      items: [
        {
          name: 'Bulges',
          conditions: [
            { label: 'No Issue', color: 'green', action: 'Good' },
            { label: 'Issue Found', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
        {
          name: 'Side Wall Cracks',
          conditions: [
            { label: 'No Issue', color: 'green', action: 'Good' },
            { label: 'Issue Found', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
        {
          name: 'Tread <1.7mm',
          conditions: [
            { label: 'No Issue', color: 'green', action: 'Good' },
            { label: 'Issue Found', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
        {
          name: 'No Damage',
          conditions: [
            { label: 'No Damage', color: 'green', action: 'Good' },
            { label: 'Has Damage', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
      ],
    },
  ],
  express: [
    {
      category: 'BATTERY',
      items: [
        {
          name: 'Battery Voltage',
          conditions: [
            { label: '12.6V – 12.8V', color: 'green', action: 'Good' },
            { label: '12.2V – 12.6V', color: 'yellow', action: 'Recharge' },
            { label: '<12.2V', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Starting Power (CCA)',
          conditions: [
            { label: '>80%', color: 'green', action: 'Good' },
            { label: '<80%', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
    {
      category: 'BELT',
      items: [
        {
          name: 'Belt Condition',
          multiSelect: true,
          conditions: [
            { label: 'Cracked', color: 'red', action: 'Replace' },
            { label: 'Side Wall', color: 'red', action: 'Replace' },
            { label: 'Loose', color: 'yellow', action: 'Adjust' },
            { label: 'No Damage', color: 'green', action: 'Good', exclusive: true },
          ],
        },
        {
          name: 'Belt Deflection',
          conditions: [
            { label: '<1/2 inch Deflection', color: 'green', action: 'Good' },
            { label: '>1/2 inch Deflection', color: 'yellow', action: 'Adjust' },
          ],
        },
      ],
    },
    {
      category: 'FLUIDS',
      items: [
        {
          name: 'Coolant Level',
          conditions: [
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
            { label: 'Contaminated', color: 'red', action: 'Flush/Replace', subOptions: ['Oil', 'Sludge', 'Rust', 'Debris'] },
            { label: 'Correct Level', color: 'green', action: 'Good' },
          ],
        },
        {
          name: 'Brake Fluid Level',
          conditions: [
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
            { label: 'Contaminated (3-4% Moisture)', color: 'red', action: 'Flush/Replace', subOptions: ['Oil', 'Sludge', 'Rust', 'Debris'] },
            { label: 'Correct Level', color: 'green', action: 'Good' },
          ],
        },
        {
          name: 'Power Steering Fluid',
          conditions: [
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
            { label: 'Contaminated', color: 'red', action: 'Flush/Replace', subOptions: ['Dark', 'Burnt', 'Rust', 'Debris'] },
            { label: 'Correct Level', color: 'green', action: 'Good' },
          ],
        },
        {
          name: 'Clutch Fluid',
          conditions: [
            { label: 'Low Level', color: 'yellow', action: 'Top Up' },
            { label: 'Contaminated (3-4% Moisture)', color: 'red', action: 'Flush/Replace' },
            { label: 'Correct Level', color: 'green', action: 'Good' },
          ],
        },
      ],
    },
    {
      category: 'STEERING LINKAGE',
      items: [
        {
          name: 'Steering Linkage',
          multiSelect: true,
          conditions: [
            { label: 'Boot Damage', color: 'red', action: 'Replace' },
            { label: 'Tie Rod Loose', color: 'red', action: 'Replace' },
            { label: 'Steering Loose', color: 'red', action: 'Replace' },
            { label: 'No Sign of Damage', color: 'green', action: 'Good', exclusive: true },
          ],
        },
      ],
    },
    {
      category: 'AIR CONDITIONER',
      subtitle: 'Check the air cleaner filter condition',
      items: [
        {
          name: 'Air Cleaner',
          instruction: 'Tap the option that best matches the filter:',
          conditions: [
            { label: 'Clean', color: 'green', action: 'Good', description: 'Filter looks white or light gray, no visible dirt buildup' },
            { label: 'Light Dirt', color: 'yellow', action: 'Clean', description: 'Some dust or discoloration visible, but still mostly clear' },
            { label: 'Clogged', color: 'red', action: 'Replace', description: 'Heavy dirt, dark color, or airflow is blocked' },
          ],
        },
      ],
    },
    {
      category: 'TIRES',
      items: [
        {
          name: 'Tread Depth',
          conditions: [
            { label: '<1.7 mm', color: 'red', action: 'Replace' },
            { label: '3.2 – 1.7 mm', color: 'yellow', action: 'Observe' },
            { label: '>3.2 mm', color: 'green', action: 'Good' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
        {
          name: 'Bulges / Side Wall Crack',
          conditions: [
            { label: 'Bulges / Side Wall Crack', color: 'red', action: 'Replace' },
            { label: 'No Issue', color: 'green', action: 'Good' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
      ],
    },
    {
      category: 'BRAKE PAD',
      items: [
        {
          name: 'Brake Pad',
          conditions: [
            { label: '<3 mm', color: 'red', action: 'Replace' },
            { label: '3 – 6 mm', color: 'yellow', action: 'Observe' },
            { label: '>6 mm', color: 'green', action: 'Good' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
      ],
    },
    {
      category: 'TEST',
      items: [
        {
          name: 'Light',
          conditions: [
            { label: 'All Good', color: 'green', action: 'Good' },
            { label: 'Busted', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Signal Light',
          conditions: [
            { label: 'All Good', color: 'green', action: 'Good' },
            { label: 'Busted', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Horn',
          conditions: [
            { label: 'All Good', color: 'green', action: 'Good' },
            { label: 'Not Working', color: 'red', action: 'Repair' },
          ],
        },
        {
          name: 'Wiper',
          conditions: [
            { label: 'All Good', color: 'green', action: 'Good' },
            { label: 'Busted', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Washer',
          conditions: [
            { label: 'All Good', color: 'green', action: 'Good' },
            { label: 'Not Working', color: 'red', action: 'Check' },
          ],
        },
      ],
    },
  ],
  plus: [], // will be set below
};

// Premium Plus — standalone (not spreading express)
INSPECTION_DATA.plus = [
  // ── BATTERY ─────────────────────────────────────────────────
  {
    category: 'BATTERY',
    items: [
      {
        name: 'Battery Voltage',
        conditions: [
          { label: '12.6V – 12.8V', color: 'green', action: 'Good' },
          { label: '12.2V – 12.6V', color: 'yellow', action: 'Recharge' },
          { label: '12.2V', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'Starting Power (CCA)',
        conditions: [
          { label: '>80%', color: 'green', action: 'Good' },
          { label: '<80%', color: 'red', action: 'Replace' },
        ],
      },
    ],
  },
  // ── BELT ────────────────────────────────────────────────────
  {
    category: 'BELT',
    items: [
      {
        name: 'Belt Condition',
        multiSelect: true,
        conditions: [
          { label: 'Cracked', color: 'red', action: 'Replace' },
          { label: 'Side Wall', color: 'red', action: 'Replace' },
          { label: 'Loose', color: 'yellow', action: 'Adjust' },
          { label: 'No Damage', color: 'green', action: 'Good', exclusive: true },
        ],
      },
      {
        name: 'Belt Deflection',
        conditions: [
          { label: '<1/2 inch Deflection', color: 'green', action: 'Good' },
          { label: '>1/2 inch Deflection', color: 'yellow', action: 'Adjust' },
        ],
      },
    ],
  },
  // ── INSPECT ENGINE BAY ──────────────────────────────────────
  {
    category: 'INSPECT ENGINE BAY',
    items: [
      {
        name: 'Coolant Level',
        conditions: [
          { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          { label: 'Contaminated', color: 'red', action: 'Flush/Replace', subOptions: ['Oil', 'Sludge', 'Rust', 'Debris'] },
          { label: 'Correct Level', color: 'green', action: 'Good' },
        ],
      },
      {
        name: 'Cooling System Hose',
        conditions: [
          { label: 'Cracked / Leaking', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
      },
      {
        name: 'Radiator Hose',
        conditions: [
          { label: 'Cracked / Swelled', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
      },
    ],
  },
  // ── BRAKE FLUID ─────────────────────────────────────────────
  {
    category: 'BRAKE FLUID',
    items: [
      {
        name: 'Brake Fluid Level',
        conditions: [
          { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          { label: 'Contaminated (3-4% Moisture)', color: 'red', action: 'Flush/Replace', subOptions: ['Oil', 'Sludge', 'Rust', 'Debris'] },
          { label: 'Correct Level', color: 'green', action: 'Good' },
        ],
      },
    ],
  },
  // ── POWER STEERING FLUID ───────────────────────────────────
  {
    category: 'POWER STEERING FLUID',
    items: [
      {
        name: 'Power Steering Fluid',
        conditions: [
          { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          { label: 'Contaminated', color: 'red', action: 'Flush/Replace', subOptions: ['Dark', 'Burnt', 'Rust', 'Debris'] },
          { label: 'Correct Level', color: 'green', action: 'Good' },
        ],
      },
    ],
  },
  // ── CLUTCH FLUID ────────────────────────────────────────────
  {
    category: 'CLUTCH FLUID',
    items: [
      {
        name: 'Clutch Fluid',
        conditions: [
          { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          { label: 'Contaminated (3-4% Moisture)', color: 'red', action: 'Flush/Replace' },
          { label: 'Correct Level', color: 'green', action: 'Good' },
        ],
      },
    ],
  },
  // ── STEERING LINKAGE ────────────────────────────────────────
  {
    category: 'STEERING LINKAGE',
    items: [
      {
        name: 'Steering Linkage',
        multiSelect: true,
        conditions: [
          { label: 'Boot Damage', color: 'red', action: 'Replace' },
          { label: 'Tie Rod Loose', color: 'red', action: 'Replace' },
          { label: 'Steering Loose', color: 'red', action: 'Replace' },
          { label: 'No Sign of Damage', color: 'green', action: 'Good', exclusive: true },
        ],
      },
    ],
  },
  // ── AIR CONDITIONER ────────────────────────────────────────
  {
    category: 'AIR CONDITIONER',
    subtitle: 'Check the air cleaner filter condition',
    items: [
      {
        name: 'Air Cleaner',
        instruction: 'Tap the option that best matches the filter:',
        conditions: [
          { label: 'Clean', color: 'green', action: 'Good', description: 'Filter looks white or light gray, no visible dirt buildup' },
          { label: 'Light Dirt', color: 'yellow', action: 'Clean', description: 'Some dust or discoloration visible, but still mostly clear' },
          { label: 'Clogged', color: 'red', action: 'Replace', description: 'Heavy dirt, dark color, or airflow is blocked' },
        ],
      },
    ],
  },
  // ── TIRES ───────────────────────────────────────────────────
  {
    category: 'TIRES',
    items: [
      {
        name: 'Tread Depth',
        conditions: [
          { label: '<1.7 mm', color: 'red', action: 'Replace' },
          { label: '3.2 – 1.7 mm', color: 'yellow', action: 'Observe' },
          { label: '>3.2 mm', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['FL', 'FR', 'RL', 'RR'],
      },
      {
        name: 'Bulges / Side Wall Crack',
        conditions: [
          { label: 'Bulges / Side Wall Crack', color: 'red', action: 'Replace' },
          { label: 'No Issue', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['FL', 'FR', 'RL', 'RR'],
      },
    ],
  },
  // ── BRAKE PAD / SHOE ────────────────────────────────────────
  {
    category: 'BRAKE PAD / SHOE',
    items: [
      {
        name: 'Brake Pad / Shoe',
        conditions: [
          { label: '<3 mm', color: 'red', action: 'Replace' },
          { label: '3 – 6 mm', color: 'yellow', action: 'Observe' },
          { label: '>6 mm', color: 'green', action: 'Good' },
          { label: 'Rotor Disc Worn', color: 'red', action: 'Reface' },
        ],
        hasPosition: true,
        positions: ['FL', 'FR', 'RL', 'RR'],
      },
    ],
  },
  // ── ENGINE SUPPORT ──────────────────────────────────────────
  {
    category: 'ENGINE SUPPORT',
    items: [
      {
        name: 'Engine Support',
        multiSelect: true,
        conditions: [
          { label: 'Crack', color: 'red', action: 'Replace' },
          { label: 'Sagging', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good', exclusive: true },
        ],
      },
    ],
  },
  // ── FUEL SYSTEM ────────────────────────────────────────────
  {
    category: 'FUEL SYSTEM',
    items: [
      {
        name: 'Fuel Tank Cap / Lines Connection',
        multiSelect: true,
        conditions: [
          { label: 'Crack / Brittle Seal', color: 'red', action: 'Replace' },
          { label: 'Fuel Lines Leak', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good', exclusive: true },
        ],
      },
    ],
  },
  // ── BRAKE PEDAL ────────────────────────────────────────────
  {
    category: 'BRAKE PEDAL',
    items: [
      {
        name: 'Brake Pedal Free Play',
        conditions: [
          { label: '1mm – 5mm', color: 'green', action: 'Good' },
          { label: '>5mm', color: 'red', action: 'Check & Adjust' },
        ],
      },
    ],
  },
  // ── SUSPENSION ARM ─────────────────────────────────────────
  {
    category: 'SUSPENSION ARM',
    items: [
      {
        name: 'Suspension Arm',
        conditions: [
          { label: 'Torn Bushing', color: 'red', action: 'Replace' },
          { label: 'Bent / Damage', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['Left', 'Right'],
      },
    ],
  },
  // ── TRANSMISSION ───────────────────────────────────────────
  {
    category: 'TRANSMISSION',
    items: [
      {
        name: 'Transmission M/T, A/T, CVT Oil',
        conditions: [
          { label: 'Contaminated', color: 'red', action: 'Replace' },
          { label: 'Low Level', color: 'yellow', action: 'Top Up' },
          { label: 'Correct Level', color: 'green', action: 'Good' },
        ],
      },
    ],
  },
  // ── BALL JOINT ─────────────────────────────────────────────
  {
    category: 'BALL JOINT',
    items: [
      {
        name: 'Ball Joint',
        conditions: [
          { label: 'Loose', color: 'red', action: 'Replace' },
          { label: 'Boot Torn', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['Left', 'Right'],
      },
    ],
  },
  // ── CLUTCH PEDAL ───────────────────────────────────────────
  {
    category: 'CLUTCH PEDAL',
    items: [
      {
        name: 'Clutch Pedal',
        conditions: [
          { label: '10mm – 20mm', color: 'green', action: 'Good' },
          { label: '>20mm', color: 'yellow', action: 'Check' },
        ],
      },
    ],
  },
  // ── FRONT SUSPENSION ───────────────────────────────────────
  {
    category: 'FRONT SUSPENSION',
    items: [
      {
        name: 'Front Suspension',
        conditions: [
          { label: 'Excess Bounce 2-3x', color: 'red', action: 'Replace' },
          { label: 'Shock Absorber Oil Leak', color: 'red', action: 'Replace' },
          { label: 'Uneven Tire Wear', color: 'red', action: 'Replace' },
          { label: 'Squeaking', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['Left', 'Right'],
      },
    ],
  },
  // ── REAR SUSPENSION ────────────────────────────────────────
  {
    category: 'REAR SUSPENSION',
    items: [
      {
        name: 'Rear Suspension',
        conditions: [
          { label: 'Excess Bounce 2-3x', color: 'red', action: 'Replace' },
          { label: 'Shock Absorber Oil Leak', color: 'red', action: 'Replace' },
          { label: 'Uneven Tire Wear', color: 'red', action: 'Replace' },
          { label: 'Squeaking', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['Left', 'Right'],
      },
    ],
  },
  // ── FOR LEAKS ─────────────────────────────────────────────
  {
    category: 'FOR LEAKS',
    items: [
      {
        name: 'For Leaks',
        multiSelect: true,
        conditions: [
          { label: 'Brake Line', color: 'red', action: 'Replace' },
          { label: 'Transfer Case', color: 'red', action: 'Replace' },
          { label: 'Transmission', color: 'red', action: 'Replace' },
          { label: 'Differential', color: 'red', action: 'Replace' },
          { label: 'No Leak', color: 'green', action: 'Good', exclusive: true },
        ],
      },
    ],
  },
  // ── EXHAUST PIPE MOUNTING ──────────────────────────────────
  {
    category: 'EXHAUST PIPE MOUNTING',
    items: [
      {
        name: 'Exhaust Pipe Mounting',
        multiSelect: true,
        optional: true,
        conditions: [
          { label: 'Exhaust Hanger Damage', color: 'red', action: 'Replace' },
          { label: 'Exhaust Gasket Leak', color: 'yellow', action: 'Check' },
        ],
      },
    ],
  },
  // ── DRIVE SHAFT BOOT ──────────────────────────────────────
  {
    category: 'DRIVE SHAFT BOOT',
    items: [
      {
        name: 'Drive Shaft Boot',
        conditions: [
          { label: 'Broken', color: 'red', action: 'Replace' },
          { label: 'Leaking', color: 'red', action: 'Replace' },
          { label: 'No Damage', color: 'green', action: 'Good' },
        ],
        hasPosition: true,
        positions: ['FL', 'FR', 'RL', 'RR'],
      },
    ],
  },
  // ── DRIVER CONTROL ────────────────────────────────────────
  {
    category: 'DRIVER CONTROL',
    items: [
      {
        name: 'Light',
        conditions: [
          { label: 'All Good', color: 'green', action: 'Good' },
          { label: 'Busted', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'Horn',
        conditions: [
          { label: 'All Good', color: 'green', action: 'Good' },
          { label: 'Not Working', color: 'red', action: 'Repair' },
        ],
      },
      {
        name: 'Washer',
        conditions: [
          { label: 'All Good', color: 'green', action: 'Good' },
          { label: 'Not Working', color: 'red', action: 'Check' },
        ],
      },
    ],
  },
];

// --- HELPER COMPONENTS ---
const colorMap = {
  green: BRAND.green,
  yellow: BRAND.yellowStatus,
  red: BRAND.red,
};
const bgColorMap = {
  green: BRAND.greenBg,
  yellow: BRAND.yellowStatusBg,
  red: BRAND.redBg,
};

function generateRIF() {
  const d = new Date();
  const prefix = 'RIF';
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${datePart}-${rand}`;
}

function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  label,
  required,
  error,
  allowAdd,
  allowCustom,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [inlineCustom, setInlineCustom] = useState(false);
  const [inlineText, setInlineText] = useState('');
  const ref = useRef(null);
  const inlineInputRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setInlineCustom(false);
      setInlineText('');
    }
  }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setInlineCustom(false);
        setInlineText('');
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    // Do not auto-focus — avoids triggering keyboard on touch devices
  }, [inlineCustom]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (o) => {
    if (o === 'Others' && allowCustom) {
      setInlineCustom(true);
      setInlineText('');
      setSearch('');
    } else {
      onChange(o);
      setOpen(false);
      setSearch('');
      setInlineCustom(false);
    }
  };

  const handleInlineConfirm = () => {
    if (inlineText.trim()) {
      onChange(inlineText.trim());
      setOpen(false);
      setInlineCustom(false);
      setInlineText('');
      setSearch('');
    }
  };

  const handleInlineCancel = () => {
    setInlineCustom(false);
    setInlineText('');
  };

  const labelEl = label && (
    <label style={{ fontWeight: 600, fontSize: 13, color: BRAND.black, marginBottom: 6, display: 'block' }}>
      {label}{required && <span style={{ color: BRAND.red }}> *</span>}
    </label>
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {labelEl}
      <div
        onClick={() => !disabled && setOpen(!open)}
        style={{
          minHeight: 48,
          border: `2px solid ${
            disabled ? BRAND.grayBorder : error ? BRAND.red : open ? BRAND.yellow : BRAND.grayBorder
          }`,
          borderRadius: 10,
          padding: '10px 14px',
          background: disabled ? BRAND.grayLight : BRAND.white,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          fontSize: 15,
          color: value ? BRAND.black : BRAND.gray,
          transition: 'border-color 0.2s',
        }}
      >
        {value || placeholder || 'Select...'}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: BRAND.gray }}>
          ▼
        </span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 999,
            background: BRAND.white,
            border: `2px solid ${BRAND.yellow}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            maxHeight: 320,
            overflow: 'hidden',
          }}
        >
          {/* Search bar — hidden when inline custom input is active */}
          {!inlineCustom && (
            <div style={{ padding: 8, borderBottom: `1px solid ${BRAND.grayBorder}` }}>
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${BRAND.grayBorder}`,
                  borderRadius: 8,
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Inline custom entry — shown when Others is selected */}
          {inlineCustom && (
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BRAND.grayBorder}`, background: BRAND.yellowPale }}>
              <div style={{ fontSize: 12, color: BRAND.gray, fontWeight: 600, marginBottom: 6 }}>
                ✏️ Type your custom entry:
              </div>
              <input
                ref={inlineInputRef}
                value={inlineText}
                onChange={(e) => setInlineText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleInlineConfirm(); }
                  if (e.key === 'Escape') handleInlineCancel();
                }}
                placeholder="Enter name and press Enter..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `2px solid ${BRAND.yellow}`,
                  borderRadius: 8,
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Options list — hidden while typing custom entry */}
          {!inlineCustom && (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filtered.length === 0 && !allowAdd && (
                <div style={{ padding: 14, color: BRAND.gray, fontSize: 14 }}>No results</div>
              )}
              {filtered.length === 0 && allowAdd && search.trim() && (
                <div
                  onClick={() => { onChange(search.trim()); setOpen(false); setSearch(''); }}
                  style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 15, color: BRAND.black, display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.yellowPale)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontWeight: 700, color: BRAND.yellow, fontSize: 18 }}>+</span>
                  Add "{search.trim()}"
                </div>
              )}
              {filtered.length === 0 && allowAdd && !search.trim() && (
                <div style={{ padding: 14, color: BRAND.gray, fontSize: 14 }}>Type to search or add a barangay</div>
              )}
              {filtered.map((o) => (
                <div
                  key={o}
                  onClick={() => handleSelect(o)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontSize: 15,
                    background: o === value ? BRAND.yellowPale : 'transparent',
                    fontWeight: o === 'Others' ? 700 : o === value ? 700 : 400,
                    color: o === 'Others' ? BRAND.gray : BRAND.black,
                    borderTop: o === 'Others' ? `1px solid ${BRAND.grayBorder}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.yellowPale)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = o === value ? BRAND.yellowPale : 'transparent')}
                >
                  {o === 'Others' && <span style={{ fontSize: 13 }}>✏️</span>}
                  {o}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BigCheckboxGroup({ options, value, onChange, label, required, error }) {
  return (
    <div>
      {label && (
        <label
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: BRAND.black,
            marginBottom: 6,
            display: 'block',
          }}
        >
          {label}
          {required && <span style={{ color: BRAND.red }}> *</span>}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', width: '100%', border: `2px solid ${error ? BRAND.red : 'transparent'}`, borderRadius: 10, padding: 2 }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              flex: 1,
              minHeight: 48,
              padding: '10px 8px',
              borderRadius: 8,
              border: `2px solid ${value === o ? BRAND.yellow : BRAND.grayBorder}`,
              background: value === o ? BRAND.yellow : BRAND.white,
              color: value === o ? BRAND.black : BRAND.gray,
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span style={{ visibility: value === o ? 'visible' : 'hidden' }}>✓</span>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  options,
  value = [],
  onChange,
  label,
  placeholder,
  required,
  error,
  allowOthers,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [othersMode, setOthersMode] = useState(false);
  const [othersText, setOthersText] = useState('');
  const othersInputRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setOthersMode(false);
        setOthersText('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    // Do not auto-focus — avoids triggering keyboard on touch devices
  }, [othersMode]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (item) => {
    if (item === 'None') {
      onChange(value.includes('None') ? [] : ['None']);
    } else {
      const without = value.filter((v) => v !== 'None');
      if (without.includes(item)) onChange(without.filter((v) => v !== item));
      else onChange([...without, item]);
    }
  };
  const confirmOthers = () => {
    if (othersText.trim()) {
      const without = value.filter((v) => v !== 'None');
      onChange([...without, othersText.trim()]);
      setOthersText('');
      setOthersMode(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: BRAND.black,
            marginBottom: 6,
            display: 'block',
          }}
        >
          {label}
          {required && <span style={{ color: BRAND.red }}> *</span>}
        </label>
      )}
      <div
        onClick={() => setOpen(!open)}
        style={{
          minHeight: 48,
          border: `2px solid ${error ? BRAND.red : open ? BRAND.yellow : BRAND.grayBorder}`,
          borderRadius: 10,
          padding: '8px 14px',
          background: BRAND.white,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          fontSize: 14,
        }}
      >
        {value.length === 0 && (
          <span style={{ color: BRAND.gray }}>
            {placeholder || 'Select...'}
          </span>
        )}
        {value.map((v) => (
          <span
            key={v}
            style={{
              background: BRAND.yellowPale,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {v}{' '}
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggle(v);
              }}
              style={{ cursor: 'pointer', marginLeft: 4 }}
            >
              ✕
            </span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: BRAND.gray }}>
          ▼
        </span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 999,
            background: BRAND.white,
            border: `2px solid ${BRAND.yellow}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            maxHeight: 300,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: `1px solid ${BRAND.grayBorder}`,
            }}
          >
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${BRAND.grayBorder}`,
                borderRadius: 8,
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 230, overflowY: 'auto' }}>
            {/* None — pinned at top, exclusive option */}
            <div
              onClick={() => toggle('None')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: value.includes('None') ? BRAND.yellowPale : 'transparent',
                borderBottom: `1px solid ${BRAND.grayBorder}`,
              }}
              onMouseEnter={(e) => { if (!value.includes('None')) e.currentTarget.style.background = BRAND.yellowPale; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = value.includes('None') ? BRAND.yellowPale : 'transparent'; }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: `2px solid ${value.includes('None') ? BRAND.yellow : BRAND.grayBorder}`,
                  background: value.includes('None') ? BRAND.yellow : BRAND.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: BRAND.black,
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {value.includes('None') && '✓'}
              </span>
              <span style={{ fontWeight: 600 }}>None</span>
            </div>
            {filtered.map((o) => (
              <div
                key={o}
                onClick={() => toggle(o)}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: value.includes(o) ? BRAND.yellowPale : 'transparent',
                }}
                onMouseEnter={(e) => { if (!value.includes(o)) e.currentTarget.style.background = BRAND.yellowPale; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = value.includes(o) ? BRAND.yellowPale : 'transparent'; }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${value.includes(o) ? BRAND.yellow : BRAND.grayBorder}`,
                  background: value.includes(o) ? BRAND.yellow : BRAND.white,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: BRAND.black, fontSize: 14, fontWeight: 700,
                }}>
                  {value.includes(o) && '✓'}
                </span>
                {o}
              </div>
            ))}

            {/* Others — pinned at bottom */}
            {allowOthers && (
              <div style={{ borderTop: `1px solid ${BRAND.grayBorder}` }}>
                <div
                  onClick={() => { setOthersMode(!othersMode); setOthersText(''); }}
                  style={{
                    padding: '12px 14px', cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: othersMode ? BRAND.yellowPale : 'transparent',
                    fontWeight: 600, color: BRAND.gray,
                  }}
                  onMouseEnter={(e) => { if (!othersMode) e.currentTarget.style.background = BRAND.yellowPale; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = othersMode ? BRAND.yellowPale : 'transparent'; }}
                >
                  <span style={{ fontSize: 14 }}>✏️</span>
                  Others (type your own)
                </div>
                {othersMode && (
                  <div style={{ padding: '8px 14px 12px', background: BRAND.yellowPale }}>
                    <input
                      ref={othersInputRef}
                      value={othersText}
                      onChange={(e) => setOthersText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); confirmOthers(); }
                        if (e.key === 'Escape') { setOthersMode(false); setOthersText(''); }
                      }}
                      placeholder="Describe the problem and press Enter..."
                      style={{
                        width: '100%', padding: '9px 12px',
                        border: `2px solid ${BRAND.yellow}`, borderRadius: 8,
                        fontSize: 14, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: 11, color: BRAND.gray, marginTop: 4 }}>
                      Press Enter to add · Esc to cancel
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  disabled,
  error,
}) {
  return (
    <div>
      {label && (
        <label
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: BRAND.black,
            marginBottom: 6,
            display: 'block',
          }}
        >
          {label}
          {required && <span style={{ color: BRAND.red }}> *</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: 48,
          padding: '10px 14px',
          border: `2px solid ${error ? BRAND.red : BRAND.grayBorder}`,
          borderRadius: 10,
          fontSize: 15,
          outline: 'none',
          background: disabled ? BRAND.grayLight : BRAND.white,
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = BRAND.yellow)}
        onBlur={(e) => (e.target.style.borderColor = error ? BRAND.red : BRAND.grayBorder)}
      />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  style: customStyle,
  variant = 'primary',
}) {
  const base = {
    minHeight: 52,
    padding: '12px 28px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };
  const variants = {
    primary: {
      background: BRAND.yellow,
      color: BRAND.black,
      opacity: disabled ? 0.5 : 1,
    },
    secondary: {
      background: BRAND.white,
      color: BRAND.black,
      border: `2px solid ${BRAND.grayBorder}`,
    },
    danger: {
      background: BRAND.red,
      color: BRAND.white,
      opacity: disabled ? 0.5 : 1,
    },
    dark: {
      background: BRAND.black,
      color: BRAND.white,
      opacity: disabled ? 0.5 : 1,
    },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...customStyle }}
    >
      {children}
    </button>
  );
}

// --- SCREENS ---

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('admin@rapide.ph');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [role, setRole] = useState('admin');

  const DEMO_USERS = {
    'admin@rapide.ph': {
      password: 'admin123',
      role: 'admin',
    },
  };

  const handleLogin = () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    const user = DEMO_USERS[email];
    if (user && user.password === password) {
      onLogin({ email, role: user.role, name: user.name });
    } else {
      setError('Invalid credentials. Try admin@rapide.ph / admin123');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${BRAND.yellow} 0%, #FFC107 50%, ${BRAND.yellowLight} 100%)`,
        padding: 20,
      }}
    >
      <div
        className="login-card"
        style={{
          background: BRAND.white,
          borderRadius: 24,
          padding: '48px 40px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              fontFamily: "'Arial Black', sans-serif",
              fontSize: 42,
              fontWeight: 900,
              fontStyle: 'italic',
              color: BRAND.black,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            Rapid
            <span style={{ position: 'relative' }}>
              é
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: `10px solid ${BRAND.red}`,
                  transform: 'rotate(15deg)',
                }}
              ></span>
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 4,
              color: BRAND.black,
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            Auto Service Experts
          </div>
          <div
            style={{
              fontSize: 14,
              color: BRAND.gray,
              marginTop: 16,
              fontWeight: 500,
            }}
          >
            Digital Inspection System
          </div>
        </div>

        {error && (
          <div
            style={{
              background: BRAND.redBg,
              color: BRAND.red,
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextInput
            label="Email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              setError('');
            }}
            placeholder="Enter email"
            required
            type="email"
          />
          <TextInput
            label="Password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError('');
            }}
            placeholder="Enter password"
            required
            type="password"
          />
          <PrimaryButton
            onClick={handleLogin}
            style={{ width: '100%', marginTop: 8 }}
          >
            Sign In
          </PrimaryButton>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: BRAND.yellowPale,
            borderRadius: 12,
            fontSize: 12,
            color: BRAND.gray,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: BRAND.black }}>
            Demo Account:
          </div>
          <div>admin@rapide.ph / admin123</div>
        </div>
      </div>
    </div>
  );
}

function TopBar({ user, onLogout, onDashboard, onManage, onReport, packageType }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user.role === 'admin' || user.role === 'service_manager';

  return (
    <>
      <div
        style={{
          background: BRAND.yellow,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 200,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              fontFamily: "'Arial Black', sans-serif",
              fontSize: 24,
              fontWeight: 900,
              fontStyle: 'italic',
              color: BRAND.black,
              letterSpacing: -1,
            }}
          >
            Rapidé
          </div>
          {packageType && (() => {
            const pkgLabel = { quick: 'QUICK', express: 'EXPRESS', plus: 'PREMIUM' };
            const pkgColor = { quick: BRAND.green, express: '#B45309', plus: BRAND.red };
            const pkgBg = { quick: '#DCFCE7', express: '#FEF3C7', plus: '#FEE2E2' };
            return (
              <span style={{
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
                background: pkgBg[packageType],
                color: pkgColor[packageType],
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                border: `1px solid ${pkgColor[packageType]}40`,
              }}>
                {pkgLabel[packageType]}
              </span>
            );
          })()}
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          <span style={{ display: 'block', width: 24, height: 3, background: BRAND.black, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 24, height: 3, background: BRAND.black, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 24, height: 3, background: BRAND.black, borderRadius: 2 }} />
        </button>
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 280, zIndex: 400,
          background: BRAND.white,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            background: BRAND.yellow,
            padding: '20px 20px 16px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: BRAND.black }}>{user.name}</div>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              color: BRAND.black, opacity: 0.6, marginTop: 2,
            }}>{user.role}</div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: BRAND.black, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, padding: '12px 0' }}>
          {isAdmin && (
            <>
              <button
                onClick={() => { onDashboard(); setMenuOpen(false); }}
                style={drawerItemStyle}
              >
                Dashboard
              </button>
              <button
                onClick={() => { onManage(); setMenuOpen(false); }}
                style={drawerItemStyle}
              >
                Manage
              </button>
              <button
                onClick={() => { onReport(); setMenuOpen(false); }}
                style={drawerItemStyle}
              >
                Report Generation
              </button>
            </>
          )}
        </div>

        {/* Logout at bottom */}
        <div style={{ padding: '12px 0', borderTop: `1px solid ${BRAND.grayBorder}` }}>
          <button
            onClick={() => { onLogout(); setMenuOpen(false); }}
            style={{ ...drawerItemStyle, color: BRAND.red }}
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

const drawerItemStyle = {
  width: '100%', background: 'none', border: 'none',
  padding: '14px 24px', textAlign: 'left',
  fontSize: 15, fontWeight: 600, color: BRAND.black,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
};
const drawerIconStyle = { fontSize: 18, width: 24, textAlign: 'center' };

// ============================================================
// MANAGE SCREEN
// ============================================================
function ManageScreen({ technicians, brands, models, municipalities, barangays, fleets, branches, onAddTechnician, onEditTechnician, onAddBrand, onAddModel, onAddMunicipality, onAddBarangay, onAddFleet, onAddBranch, onEditBranch }) {
  const [showAddTech, setShowAddTech] = useState(false);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [showAddMunicipality, setShowAddMunicipality] = useState(false);
  const [showAddBarangay, setShowAddBarangay] = useState(false);
  const [showAddFleet, setShowAddFleet] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [editingTech, setEditingTech] = useState(null); // { id, name }
  const [editTechName, setEditTechName] = useState('');
  const [newTechName, setNewTechName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelBrand, setNewModelBrand] = useState('');
  const [newMunicipalityName, setNewMunicipalityName] = useState('');
  const [newBarangayName, setNewBarangayName] = useState('');
  const [newBarangayMunicipality, setNewBarangayMunicipality] = useState('');
  const [newFleetName, setNewFleetName] = useState('');

  const sectionStyle = {
    background: BRAND.white,
    borderRadius: 12,
    border: `2px solid ${BRAND.grayBorder}`,
    padding: '20px 20px',
    marginBottom: 16,
  };
  const sectionHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  };
  const sectionTitleStyle = { fontSize: 16, fontWeight: 800, color: BRAND.black, margin: 0 };
  const chipStyle = {
    display: 'inline-block',
    background: BRAND.grayLight,
    border: `1px solid ${BRAND.grayBorder}`,
    borderRadius: 8,
    padding: '5px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: BRAND.black,
    margin: '4px 4px 4px 0',
  };

  return (
    <div className="form-screen">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: BRAND.black, margin: 0 }}>Manage</h2>
        <p style={{ color: BRAND.gray, fontSize: 14, margin: 0, marginTop: 4 }}>
          Branches, Technicians, Brands, Models, Locations & Fleet Customers
        </p>
      </div>

      {/* Branches */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Branches</h3>
          <PrimaryButton
            onClick={() => setShowAddBranch(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div>
          {(branches || []).map((b) => (
            <span key={b.id} style={{ ...chipStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {b.name}
              <button
                type="button"
                onClick={() => { setEditingBranch(b); setEditBranchName(b.name); }}
                title="Edit name"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: BRAND.gray, lineHeight: 1 }}
              >✏️</button>
            </span>
          ))}
          {(!branches || branches.length === 0) && (
            <p style={{ color: BRAND.gray, fontSize: 14, margin: 0 }}>No branches configured.</p>
          )}
        </div>
      </div>

      {/* Technicians */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Technicians</h3>
          <PrimaryButton
            onClick={() => setShowAddTech(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div>
          {technicians.map((t) => (
            <span key={t.id} style={{ ...chipStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.name}
              <button
                type="button"
                onClick={() => { setEditingTech(t); setEditTechName(t.name); }}
                title="Edit name"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: BRAND.gray, lineHeight: 1 }}
              >✏️</button>
            </span>
          ))}
          {technicians.length === 0 && (
            <p style={{ color: BRAND.gray, fontSize: 14, margin: 0 }}>No technicians yet. Click + Add to get started.</p>
          )}
        </div>
      </div>

      {/* Car Brands */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Car Brands</h3>
          <PrimaryButton
            onClick={() => setShowAddBrand(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div>
          {brands.map((b) => (
            <span key={b} style={chipStyle}>{b}</span>
          ))}
        </div>
      </div>

      {/* Car Models */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Car Models</h3>
          <PrimaryButton
            onClick={() => setShowAddModel(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div>
          {Object.entries(models).map(([brand, modelList]) =>
            modelList.map((m) => (
              <span key={`${brand}-${m}`} style={chipStyle}>{brand} – {m}</span>
            ))
          )}
        </div>
      </div>

      {/* Add Technician Modal */}
      {showAddTech && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Technician</h3>
            <TextInput label="Full Name" required value={newTechName} onChange={setNewTechName} placeholder="Technician name" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddTech(false); setNewTechName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newTechName.trim()) { onAddTechnician(newTechName.trim()); setNewTechName(''); setShowAddTech(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Technician Modal */}
      {editingTech && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Edit Technician</h3>
            <TextInput label="Full Name" required value={editTechName} onChange={setEditTechName} placeholder="Technician name" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setEditingTech(null); setEditTechName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => {
                if (editTechName.trim()) {
                  onEditTechnician(editingTech.id, editTechName.trim());
                  setEditingTech(null);
                  setEditTechName('');
                }
              }}>Save</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Branch</h3>
            <TextInput label="Branch Name" required value={newBranchName} onChange={setNewBranchName} placeholder="e.g. Rapide Ayala" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddBranch(false); setNewBranchName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newBranchName.trim()) { onAddBranch(newBranchName.trim()); setNewBranchName(''); setShowAddBranch(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Edit Branch</h3>
            <TextInput label="Branch Name" required value={editBranchName} onChange={setEditBranchName} placeholder="Branch name" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setEditingBranch(null); setEditBranchName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => {
                if (editBranchName.trim()) {
                  onEditBranch(editingBranch.id, editBranchName.trim());
                  setEditingBranch(null);
                  setEditBranchName('');
                }
              }}>Save</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Brand Modal */}
      {showAddBrand && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Car Brand</h3>
            <TextInput label="Brand Name" required value={newBrandName} onChange={setNewBrandName} placeholder="e.g. Volvo" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddBrand(false); setNewBrandName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newBrandName.trim()) { onAddBrand(newBrandName.trim()); setNewBrandName(''); setShowAddBrand(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Model Modal */}
      {showAddModel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Car Model</h3>
            <div style={{ marginBottom: 16 }}>
              <SearchableDropdown label="Brand" required options={brands} value={newModelBrand} onChange={setNewModelBrand} placeholder="Select brand..." />
            </div>
            <TextInput label="Model Name" required value={newModelName} onChange={setNewModelName} placeholder="e.g. Corolla Cross" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddModel(false); setNewModelName(''); setNewModelBrand(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newModelName.trim() && newModelBrand) { onAddModel(newModelBrand, newModelName.trim()); setNewModelName(''); setNewModelBrand(''); setShowAddModel(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Cities / Municipalities */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Cities / Municipalities</h3>
          <PrimaryButton
            onClick={() => setShowAddMunicipality(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {municipalities.filter(m => m !== 'Others').map((m) => (
            <span key={m} style={chipStyle}>{m}</span>
          ))}
        </div>
      </div>

      {/* Barangays */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Barangays</h3>
          <PrimaryButton
            onClick={() => setShowAddBarangay(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {Object.entries(barangays).slice(0, 5).map(([mun, brgys]) =>
            brgys.slice(0, 3).map((b) => (
              <span key={`${mun}-${b}`} style={chipStyle}>{mun} – {b}</span>
            ))
          )}
          {Object.keys(barangays).length > 5 && (
            <p style={{ color: BRAND.gray, fontSize: 12, margin: '6px 0 0' }}>
              ...and more ({Object.values(barangays).reduce((s, a) => s + a.length, 0)} total barangays)
            </p>
          )}
        </div>
      </div>

      {/* Add Municipality Modal */}
      {showAddMunicipality && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add City / Municipality</h3>
            <TextInput label="Name" required value={newMunicipalityName} onChange={setNewMunicipalityName} placeholder="e.g. Calamba" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddMunicipality(false); setNewMunicipalityName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newMunicipalityName.trim()) { onAddMunicipality(newMunicipalityName.trim()); setNewMunicipalityName(''); setShowAddMunicipality(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Barangay Modal */}
      {showAddBarangay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Barangay</h3>
            <div style={{ marginBottom: 16 }}>
              <SearchableDropdown label="City / Municipality" required options={municipalities} value={newBarangayMunicipality} onChange={setNewBarangayMunicipality} placeholder="Select city..." />
            </div>
            <TextInput label="Barangay Name" required value={newBarangayName} onChange={setNewBarangayName} placeholder="e.g. Bagong Nayon" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddBarangay(false); setNewBarangayName(''); setNewBarangayMunicipality(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newBarangayName.trim() && newBarangayMunicipality) { onAddBarangay(newBarangayMunicipality, newBarangayName.trim()); setNewBarangayName(''); setNewBarangayMunicipality(''); setShowAddBarangay(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Customers */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Fleet Customers</h3>
          <PrimaryButton
            onClick={() => setShowAddFleet(true)}
            style={{ fontSize: 13, padding: '7px 14px', minHeight: 36 }}
          >
            + Add
          </PrimaryButton>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {fleets.map((f) => (
            <span key={f} style={chipStyle}>{f}</span>
          ))}
          {fleets.length === 0 && (
            <p style={{ color: BRAND.gray, fontSize: 14, margin: 0 }}>No fleet customers yet.</p>
          )}
        </div>
      </div>

      {/* Add Fleet Modal */}
      {showAddFleet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: BRAND.white, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Fleet Customer</h3>
            <TextInput label="Company Name" required value={newFleetName} onChange={setNewFleetName} placeholder="e.g. Toyota Mobility Solutions" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={() => { setShowAddFleet(false); setNewFleetName(''); }} variant="secondary">Cancel</PrimaryButton>
              <PrimaryButton onClick={() => { if (newFleetName.trim()) { onAddFleet(newFleetName.trim()); setNewFleetName(''); setShowAddFleet(false); } }}>Add</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageSelectionScreen({ onSelect }) {
  const pkgs = [
    {
      id: 'quick',
      label: 'QUICK',
      desc: 'Basic fluid & visual check',
      color: '#22C55E',
    },
    {
      id: 'express',
      label: 'EXPRESS',
      desc: 'Comprehensive multi-point inspection',
      color: BRAND.yellow,
    },
    {
      id: 'plus',
      label: 'PREMIUM',
      desc: 'Full-system detailed inspection',
      color: BRAND.red,
    },
  ];
  return (
    <div className="form-screen" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: BRAND.black,
            margin: 0,
          }}
        >
          Select Inspection Package
        </h1>
        <p style={{ fontSize: 15, color: BRAND.gray, marginTop: 8 }}>
          Choose the inspection type to begin
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pkgs.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              minHeight: 100,
              padding: '24px 32px',
              borderRadius: 16,
              border: `3px solid ${p.color}`,
              background: BRAND.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
              }}
            />
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: BRAND.black,
                  letterSpacing: 1,
                }}
              >
                {p.label}
              </div>
              <div style={{ fontSize: 14, color: BRAND.gray, marginTop: 4 }}>
                {p.desc}
              </div>
            </div>
            <span
              style={{ marginLeft: 'auto', fontSize: 24, color: BRAND.gray }}
            >
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomerVehicleScreen({ data, setData, onSave, brands, models, municipalities, barangays, fleets, branches }) {
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const availableModels = data.make ? [...(models[data.make] || []), 'Others'] : [];
  const availableBarangays = data.city ? [...(barangays[data.city] || []), 'Others'] : [];

  const validate = () => {
    const e = {};
    if (!data.make) e.make = true;
    if (!data.model) e.model = true;
    if (!data.year) e.year = true;
    if (!data.plateNo) e.plateNo = true;
    if (!data.transmission) e.transmission = true;
    if (!data.fuelType) e.fuelType = true;
    if (!data.kmReading) e.kmReading = true;
    if (!data.title) e.title = true;
    if (!data.firstName) e.firstName = true;
    if (!data.lastName) e.lastName = true;
    if (!data.mobileNo || data.mobileNo.replace(/\D/g, '').length !== 11) e.mobileNo = true;
    if (!data.email) e.email = true;
    if (data.fleetType === 'Fleet' && !data.company) e.company = true;
    if (!data.city) e.city = true;
    if (!data.barangay) e.barangay = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    setAttempted(true);
    if (validate()) onSave();
  };
  const update = (k, v) => {
    setData({ ...data, [k]: v });
    setErrors({ ...errors, [k]: false });
  };

  return (
    <div className="form-screen">
      <h2 style={{ fontSize: 22, fontWeight: 900, color: BRAND.black, marginBottom: 4 }}>
        Customer & Vehicle Details
      </h2>
      <p style={{ color: BRAND.gray, fontSize: 14, marginBottom: 16 }}>
        Fill in vehicle and customer information
      </p>

      {/* Vehicle Section */}
      <div className="form-card">
        <h3
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: BRAND.black,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              background: BRAND.yellow,
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            🚗
          </span>
          Vehicle Details
        </h3>
        <div className="form-grid">
          <SearchableDropdown
            label="Make"
            required
            error={!!errors.make}
            options={brands}
            value={data.make}
            onChange={(v) => {
              setData({ ...data, make: v, model: '' });
              setErrors({ ...errors, make: false, model: false });
            }}
            placeholder="Select brand..."
            allowCustom
          />
          <SearchableDropdown
            label="Model"
            required
            error={!!errors.model}
            options={availableModels}
            value={data.model}
            onChange={(v) => update('model', v)}
            placeholder="Select model..."
            disabled={!data.make}
            allowCustom
          />
          <SearchableDropdown
            label="Year"
            required
            error={!!errors.year}
            options={YEARS}
            value={data.year}
            onChange={(v) => update('year', v)}
            placeholder="Select year..."
          />
          <TextInput
            label="Plate Number"
            required
            error={!!errors.plateNo}
            value={data.plateNo || ''}
            onChange={(v) => update('plateNo', v.toUpperCase())}
            placeholder="e.g. ABC 1234"
          />
          <BigCheckboxGroup
            label="Transmission"
            required
            error={!!errors.transmission}
            options={['Manual', 'A/T', 'CVT']}
            value={data.transmission}
            onChange={(v) => update('transmission', v)}
          />
          <BigCheckboxGroup
            label="Fuel Type"
            required
            error={!!errors.fuelType}
            options={['Gas', 'Diesel', 'EV/HEV']}
            value={data.fuelType}
            onChange={(v) => update('fuelType', v)}
          />
          <SearchableDropdown
            label="KM Reading"
            required
            error={!!errors.kmReading}
            options={KM_READINGS}
            value={data.kmReading}
            onChange={(v) => update('kmReading', v)}
            placeholder="Select KM..."
          />
          <TextInput
            label="Date"
            value={data.date || new Date().toLocaleDateString('en-PH')}
            disabled
          />
        </div>
      </div>

      {/* Customer Section */}
      <div className="form-card">
        <h3
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: BRAND.black,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              background: BRAND.yellow,
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            👤
          </span>
          Customer Details
        </h3>
        <div className="form-grid">
          <BigCheckboxGroup
            label="Title"
            required
            error={!!errors.title}
            options={['Mr', 'Ms']}
            value={data.title}
            onChange={(v) => update('title', v)}
          />
          <TextInput
            label="First Name"
            required
            error={!!errors.firstName}
            value={data.firstName || ''}
            onChange={(v) => update('firstName', v)}
            placeholder="First name"
          />
          <TextInput
            label="Last Name"
            required
            error={!!errors.lastName}
            value={data.lastName || ''}
            onChange={(v) => update('lastName', v)}
            placeholder="Last name"
          />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 auto' }}>
              <BigCheckboxGroup
                label="Fleet / Non-Fleet"
                options={['Fleet', 'Non-Fleet']}
                value={data.fleetType}
                onChange={(v) => {
                  setData({ ...data, fleetType: v, company: v === 'Non-Fleet' ? '' : data.company });
                  setErrors({ ...errors, fleetType: false });
                }}
              />
            </div>
            {data.fleetType === 'Fleet' && (
              <div style={{ flex: 1 }}>
                <SearchableDropdown
                  label="Fleet Account"
                  required
                  error={!!errors.company}
                  options={fleets}
                  value={data.company}
                  onChange={(v) => {
                    setData({ ...data, company: v });
                    setErrors({ ...errors, company: false });
                  }}
                  placeholder="Select fleet..."
                  allowCustom
                />
              </div>
            )}
          </div>
          <TextInput
            label="Mobile Number"
            required
            error={!!errors.mobileNo}
            value={data.mobileNo || ''}
            onChange={(v) => update('mobileNo', v.replace(/\D/g, '').slice(0, 11))}
            placeholder="09XXXXXXXXX"
            type="tel"
          />
          <TextInput
            label="Email"
            required
            error={!!errors.email}
            value={data.email || ''}
            onChange={(v) => update('email', v.replace(/\s/g, ''))}
            placeholder="Enter email"
          />
          <SearchableDropdown
            label="City / Municipality"
            required
            error={!!errors.city}
            options={municipalities}
            value={data.city}
            onChange={(v) => {
              setData({ ...data, city: v, barangay: '' });
              setErrors({ ...errors, city: false, barangay: false });
            }}
            placeholder="Select city..."
            allowCustom
          />
          <SearchableDropdown
            label="Barangay"
            required
            error={!!errors.barangay}
            options={availableBarangays}
            value={data.barangay}
            onChange={(v) => update('barangay', v)}
            placeholder={data.city ? 'Select or type barangay...' : 'Select city first'}
            disabled={!data.city}
            allowAdd={availableBarangays.length === 0}
            allowCustom
          />
          {/* Branch field */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontWeight: 600, fontSize: 13, color: BRAND.black, marginBottom: 6, display: 'block' }}>
              Branch
            </label>
            <select
              disabled={!branches || branches.length <= 1}
              value={data.branch || (branches && branches[0]?.name) || 'Rapide San Antonio'}
              onChange={(e) => update('branch', e.target.value)}
              style={{
                width: '100%', minHeight: 44, padding: '8px 14px',
                border: `2px solid ${BRAND.grayBorder}`, borderRadius: 10, fontSize: 14,
                background: (!branches || branches.length <= 1) ? BRAND.grayLight : BRAND.white,
                color: BRAND.black, fontWeight: 600, appearance: 'auto',
              }}
            >
              {(branches || [{ id: 1, name: 'Rapide San Antonio' }]).map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            {(!branches || branches.length <= 1) && (
              <p style={{ fontSize: 12, color: BRAND.gray, margin: '4px 0 0' }}>
                Branch selection is available when multiple branches are configured in Manage.
              </p>
            )}
          </div>
        </div>
      </div>

      {attempted && Object.keys(errors).filter(k => errors[k]).length > 0 && (
        <div
          style={{
            background: BRAND.redBg,
            color: BRAND.red,
            padding: '12px 16px',
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 16,
            fontWeight: 600,
          }}
        >
          Please fill in all required fields.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20 }}>
        <PrimaryButton onClick={handleSave}>Save →</PrimaryButton>
      </div>
    </div>
  );
}

function ServiceQuestionsScreen({
  data,
  setData,
  onSave,
  technicians,
}) {
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const years = Array.from({ length: 10 }, (_, i) => (2026 - i).toString());

  const update = (k, v) => {
    setData({ ...data, [k]: v });
    setErrors({ ...errors, [k]: false });
  };

  const handleSave = () => {
    setAttempted(true);
    const e = {};
    if (!data.lastPmsMonth) e.lastPmsMonth = true;
    if (!data.lastPmsYear) e.lastPmsYear = true;
    if (!data.replacedParts || data.replacedParts.length === 0) e.replacedParts = true;
    if (!data.currentProblems || data.currentProblems.length === 0) e.currentProblems = true;
    if (!data.technicianId) e.technicianId = true;
    setErrors(e);
    if (Object.keys(e).length === 0) onSave();
  };

  return (
    <div className="form-screen">
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: BRAND.black,
          marginBottom: 4,
        }}
      >
        Service Questions
      </h2>
      <p style={{ color: BRAND.gray, fontSize: 14, marginBottom: 16 }}>
        Capture context and assign technician
      </p>

      <div
        className="form-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <label
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: BRAND.black,
              marginBottom: 6,
              display: 'block',
            }}
          >
            When was your last Change Oil / PMS?
            <span style={{ color: BRAND.red }}> *</span>
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <SearchableDropdown
                error={!!errors.lastPmsMonth}
                options={months}
                value={data.lastPmsMonth}
                onChange={(v) => update('lastPmsMonth', v)}
                placeholder="Month"
              />
            </div>
            <div style={{ flex: 1 }}>
              <SearchableDropdown
                error={!!errors.lastPmsYear}
                options={years}
                value={data.lastPmsYear}
                onChange={(v) => update('lastPmsYear', v)}
                placeholder="Year"
              />
            </div>
          </div>
        </div>

        <MultiSelectDropdown
          label="What parts were replaced in your last service?"
          required
          error={!!errors.replacedParts}
          options={REPLACED_PARTS}
          value={data.replacedParts || []}
          onChange={(v) => update('replacedParts', v)}
          placeholder="Select parts..."
        />

        <MultiSelectDropdown
          label="Any problems with your vehicle at the moment?"
          required
          error={!!errors.currentProblems}
          options={serviceComplaintsData.complaints}
          value={data.currentProblems || []}
          onChange={(v) => update('currentProblems', v)}
          placeholder="Select complaints..."
          allowOthers
        />

      </div>

      {/* Assign Technician */}
      <div
        className="form-card"
        style={{ border: `2px solid ${attempted && errors.technicianId ? BRAND.red : BRAND.grayBorder}` }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 800, color: BRAND.black, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: BRAND.yellow, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔧</span>
          Assign Technician
        </h3>
        <SearchableDropdown
          label="Technician"
          required
          error={attempted && !!errors.technicianId}
          options={technicians.filter((t) => t.active).map((t) => t.name)}
          value={data.technicianName || ''}
          onChange={(v) => {
            const tech = technicians.find((t) => t.name === v);
            setData({ ...data, technicianId: tech?.id, technicianName: v });
            setErrors({ ...errors, technicianId: false });
          }}
          placeholder="Select technician..."
        />
        {attempted && errors.technicianId && (
          <p style={{ color: BRAND.red, fontSize: 13, fontWeight: 700, margin: '10px 0 0' }}>
            Please assign a technician.
          </p>
        )}
      </div>

      {attempted && Object.keys(errors).filter(k => errors[k]).length > 0 && (
        <div style={{ background: BRAND.redBg, color: BRAND.red, padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 16, fontWeight: 600 }}>
          Please fill in all required fields.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20 }}>
        <PrimaryButton onClick={handleSave}>Save →</PrimaryButton>
      </div>
    </div>
  );
}

function InspectionScreen({
  categories,
  findings,
  setFindings,
  currentCategoryIdx,
  setCurrentCategoryIdx,
  onFinish,
  onBack,
  onFillDemo,
}) {
  const [attempted, setAttempted] = useState(false);
  const [activePosition, setActivePosition] = useState(null); // { itemName, pos }
  const fileInputRefs = useRef({});
  const uploadInputRefs = useRef({});
  const posUploadInputRefs = useRef({});
  const [cameraModal, setCameraModal] = useState(null); // { key, pos } pos=null for item-level
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!cameraModal) return;
    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => setCameraModal(null));
    return () => {
      stopped = true;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [cameraModal]);

  const closeCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraModal(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (cameraModal.pos !== null) {
      setFindings((prev) => {
        const existing = prev[cameraModal.key] || {};
        const existingPositions = existing.positions || {};
        const existingPos = existingPositions[cameraModal.pos] || {};
        return { ...prev, [cameraModal.key]: { ...existing, positions: { ...existingPositions, [cameraModal.pos]: { ...existingPos, photo: dataUrl } } } };
      });
    } else {
      setFindings((prev) => ({ ...prev, [cameraModal.key]: { ...(prev[cameraModal.key] || {}), photo: dataUrl } }));
    }
    closeCamera();
  };

  const handlePhotoCapture = (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFindings((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), photo: ev.target.result },
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePositionPhotoCapture = (key, pos, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFindings((prev) => {
        const existing = prev[key] || {};
        const existingPositions = existing.positions || {};
        const existingPos = existingPositions[pos] || {};
        return {
          ...prev,
          [key]: {
            ...existing,
            positions: {
              ...existingPositions,
              [pos]: { ...existingPos, photo: ev.target.result },
            },
          },
        };
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cat = categories[currentCategoryIdx];
  const isFirst = currentCategoryIdx === 0;
  const isLast = currentCategoryIdx === categories.length - 1;

  const getKey = (catName, itemName) => `${catName}::${itemName}`;

  const allFilled = cat.items.every((item) => {
    if (item.optional) return true;
    const key = getKey(cat.category, item.name);
    const finding = findings[key];
    if (item.hasPosition) {
      return finding?.noDamage === true ||
        (finding?.positions && item.positions.every((p) => finding.positions[p]));
    }
    if (!finding) return false;
    if (item.multiSelect) return (finding.conditionIdxs?.length || 0) > 0;
    const selectedCond = item.conditions[finding.conditionIdx];
    if (selectedCond?.subOptions?.length && !finding.subOption) return false;
    return true;
  });

  const handleNext = () => {
    if (!allFilled) { setAttempted(true); return; }
    setAttempted(false);
    setActivePosition(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (isLast) onFinish();
    else setCurrentCategoryIdx(currentCategoryIdx + 1);
  };

  const selectCondition = (itemName, condIdx) => {
    const key = getKey(cat.category, itemName);
    const item = cat.items.find((i) => i.name === itemName);
    const cond = item.conditions[condIdx];
    setFindings((prev) => {
      if (prev[key]?.conditionIdx === condIdx) {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      }
      return { ...prev, [key]: { conditionIdx: condIdx, condition: cond.label, action: cond.action, color: cond.color } };
    });
    setAttempted(false);
  };

  const selectSubOption = (itemName, subOption) => {
    const key = getKey(cat.category, itemName);
    setFindings((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: { ...prev[key], subOption } };
    });
  };

  const selectMultiCondition = (itemName, condIdx) => {
    const key = getKey(cat.category, itemName);
    const item = cat.items.find((i) => i.name === itemName);
    const cond = item.conditions[condIdx];
    setFindings((prev) => {
      const existing = prev[key]?.conditionIdxs || [];
      if (existing.includes(condIdx)) {
        const next = existing.filter((i) => i !== condIdx);
        if (next.length === 0) { const u = { ...prev }; delete u[key]; return u; }
        return { ...prev, [key]: { conditionIdxs: next } };
      }
      if (cond.exclusive) {
        return { ...prev, [key]: { conditionIdxs: [condIdx] } };
      }
      const exclusiveIdxs = item.conditions.map((c, i) => c.exclusive ? i : -1).filter((i) => i >= 0);
      const next = [...existing.filter((i) => !exclusiveIdxs.includes(i)), condIdx];
      return { ...prev, [key]: { conditionIdxs: next } };
    });
    setAttempted(false);
  };

  const selectPositionCondition = (itemName, pos, condIdx) => {
    const key = getKey(cat.category, itemName);
    const item = cat.items.find((i) => i.name === itemName);
    const cond = item.conditions[condIdx];
    setFindings((prev) => {
      const existing = prev[key] || { positions: {} };
      if (existing.positions?.[pos]?.conditionIdx === condIdx) {
        const updatedPositions = { ...existing.positions };
        delete updatedPositions[pos];
        return { ...prev, [key]: { positions: updatedPositions, noDamage: false } };
      }
      return {
        ...prev,
        [key]: {
          positions: {
            ...(existing.positions || {}),
            [pos]: { conditionIdx: condIdx, condition: cond.label, action: cond.action, color: cond.color },
          },
          noDamage: false,
        },
      };
    });
    setAttempted(false);
  };

  const handleNoDamage = (itemName) => {
    const key = getKey(cat.category, itemName);
    const item = cat.items.find((i) => i.name === itemName);
    const isCurrentlyNoDamage = !!findings[key]?.noDamage;
    if (isCurrentlyNoDamage) {
      setFindings((prev) => { const u = { ...prev }; delete u[key]; return u; });
    } else {
      const greenIdx = item.conditions.findIndex((c) => c.color === 'green');
      const greenCond = greenIdx >= 0 ? item.conditions[greenIdx] : null;
      setFindings((prev) => {
        if (greenCond) {
          const positions = {};
          item.positions.forEach((p) => {
            positions[p] = { conditionIdx: greenIdx, condition: greenCond.label, action: greenCond.action, color: greenCond.color };
          });
          return { ...prev, [key]: { positions, noDamage: true } };
        }
        return { ...prev, [key]: { noDamage: true } };
      });
    }
    setAttempted(false);
  };

  const progress = ((currentCategoryIdx + 1) / categories.length) * 100;

  return (
    <div
      className="form-screen" style={{ paddingBottom: 100 }}
    >
      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.gray }}>
            Category {currentCategoryIdx + 1} of {categories.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>
              {Math.round(progress)}%
            </span>
            {onFillDemo && (
              <button
                onClick={onFillDemo}
                style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 6, border: `1px solid ${BRAND.grayBorder}`,
                  background: BRAND.grayLight, color: BRAND.gray, cursor: 'pointer',
                }}
              >
                Fill Demo
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            height: 6,
            background: BRAND.grayLight,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: BRAND.yellow,
              borderRadius: 3,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: BRAND.white,
          margin: 0,
          marginBottom: 20,
          background: BRAND.black,
          padding: '16px 20px',
          borderRadius: 14,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {cat.category}
      </h2>

      {cat.subtitle && (
        <div style={{
          fontSize: 14, color: BRAND.gray, fontWeight: 500,
          marginTop: -12, marginBottom: 16, padding: '0 4px',
          lineHeight: 1.4,
        }}>
          {cat.subtitle}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cat.items.map((item) => {
          const key = getKey(cat.category, item.name);
          const finding = findings[key];

          const unanswered = !item.optional && attempted && (
            item.hasPosition
              ? !finding?.noDamage && (!finding?.positions || !item.positions.every((p) => finding.positions[p]))
              : item.multiSelect ? !(finding?.conditionIdxs?.length > 0) : !finding
          );

          // For multi-select: derive worst color from selected conditions
          const multiSelectColors = item.multiSelect
            ? (finding?.conditionIdxs || []).map((i) => item.conditions[i]?.color).filter(Boolean)
            : [];
          const worstMultiColor = multiSelectColors.includes('red') ? 'red'
            : multiSelectColors.includes('yellow') ? 'yellow'
            : multiSelectColors.length > 0 ? 'green' : null;

          // Card border: worst color among filled positions, or single finding color
          let cardBorder = BRAND.grayBorder;
          if (unanswered) cardBorder = BRAND.red;
          else if (item.hasPosition && finding?.noDamage) {
            cardBorder = colorMap.green;
          } else if (item.hasPosition && finding?.positions) {
            const cols = item.positions.map((p) => finding.positions[p]?.color).filter(Boolean);
            if (cols.includes('red')) cardBorder = colorMap.red;
            else if (cols.includes('yellow')) cardBorder = colorMap.yellow;
            else if (cols.length > 0) cardBorder = colorMap.green;
          } else if (item.multiSelect && worstMultiColor) {
            cardBorder = colorMap[worstMultiColor];
          } else if (!item.hasPosition && finding) {
            cardBorder = colorMap[finding.color];
          }

          const showCamera = (
            (!item.hasPosition && !item.multiSelect && finding && (finding.color === 'yellow' || finding.color === 'red')) ||
            (!item.hasPosition && item.multiSelect && (worstMultiColor === 'yellow' || worstMultiColor === 'red'))
          );

          return (
            <div
              key={item.name}
              style={{
                background: BRAND.white,
                borderRadius: 14,
                border: `2px solid ${cardBorder}`,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Item name header */}
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BRAND.grayBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: BRAND.black }}>{item.name}</div>
                  {item.instruction && (
                    <div style={{ fontSize: 12, color: BRAND.gray, fontWeight: 400, marginTop: 2, lineHeight: 1.3 }}>
                      {item.instruction}
                    </div>
                  )}
                </div>
                {showCamera && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    {finding?.photo && (
                      <img
                        src={finding.photo}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: `2px solid ${cardBorder}`, cursor: 'pointer' }}
                        onClick={() => window.open(finding.photo, '_blank')}
                      />
                    )}
                    <button
                      onClick={() => setCameraModal({ key, pos: null })}
                      title="Take photo"
                      style={{ background: cardBorder, border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => uploadInputRefs.current[key]?.click()}
                      title="Upload photo"
                      style={{ background: '#6B7280', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </button>
                    <input ref={(el) => { uploadInputRefs.current[key] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoCapture(key, e)} />
                  </div>
                )}
              </div>

              {item.hasPosition ? (() => {
                const isNoDamage = !!finding?.noDamage;
                const greenIdx = item.conditions.findIndex((c) => c.color === 'green');
                const greenCond = greenIdx >= 0 ? item.conditions[greenIdx] : null;
                const issueConditions = item.conditions
                  .map((c, i) => ({ ...c, idx: i }));
                // Group positions: FL/FR/RL/RR → Front + Rear; others → single group
                const hasFrontRear = item.positions.includes('FL') && item.positions.includes('RL');
                const groups = hasFrontRear
                  ? [
                      { label: 'Front', positions: item.positions.filter((p) => p === 'FL' || p === 'FR') },
                      { label: 'Rear', positions: item.positions.filter((p) => p === 'RL' || p === 'RR') },
                    ]
                  : [{ label: null, positions: item.positions }];
                return (
                  <div>
                    {groups.map((group) => (
                      <div
                        key={group.label || 'group'}
                        style={{
                          borderBottom: `1px solid ${BRAND.grayBorder}`,
                          opacity: isNoDamage ? 0.35 : 1,
                          pointerEvents: isNoDamage ? 'none' : 'auto',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        {group.label && (
                          <div style={{
                            padding: '6px 14px',
                            background: BRAND.grayLight,
                            borderBottom: `1px solid ${BRAND.grayBorder}`,
                            fontWeight: 800, fontSize: 11, color: BRAND.gray,
                            textTransform: 'uppercase', letterSpacing: 1,
                          }}>
                            {group.label}
                          </div>
                        )}
                        <div style={{ display: 'flex' }}>
                          {group.positions.map((pos, pi) => {
                            const pf = finding?.positions?.[pos];
                            const posRefKey = `${key}::${pos}`;
                            const needsPhoto = pf?.color === 'red' || pf?.color === 'yellow';
                            return (
                              <div
                                key={pos}
                                style={{
                                  flex: 1,
                                  borderRight: pi < group.positions.length - 1 ? `1px solid ${BRAND.grayBorder}` : 'none',
                                }}
                              >
                                {/* Position header */}
                                <div style={{
                                  padding: '8px 10px',
                                  borderBottom: `1px solid ${BRAND.grayBorder}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  background: pf ? bgColorMap[pf.color] : BRAND.white,
                                }}>
                                  <span style={{ fontWeight: 900, fontSize: 17, color: pf ? colorMap[pf.color] : BRAND.black }}>{({ FL: 'Left', FR: 'Right', RL: 'Left', RR: 'Right' })[pos] || pos}</span>
                                  {pf && (
                                    <span style={{ fontSize: 9, fontWeight: 800, color: colorMap[pf.color], textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      {pf.action}
                                    </span>
                                  )}
                                </div>
                                {/* Issue conditions */}
                                {issueConditions.map((cond) => {
                                  const isSelected = pf?.conditionIdx === cond.idx;
                                  return (
                                    <div
                                      key={cond.idx}
                                      onClick={() => selectPositionCondition(item.name, pos, cond.idx)}
                                      style={{
                                        padding: '9px 10px',
                                        cursor: 'pointer',
                                        background: isSelected ? bgColorMap[cond.color] : 'transparent',
                                        borderBottom: `1px solid ${BRAND.grayBorder}`,
                                        display: 'flex', alignItems: 'flex-start', gap: 7,
                                        transition: 'background 0.15s',
                                      }}
                                    >
                                      <div style={{
                                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                                        border: `2px solid ${isSelected ? colorMap[cond.color] : BRAND.grayBorder}`,
                                        background: isSelected ? colorMap[cond.color] : BRAND.white,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: BRAND.white, fontSize: 10, fontWeight: 700,
                                      }}>
                                        {isSelected && '✓'}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? colorMap[cond.color] : BRAND.black, lineHeight: 1.25 }}>
                                          {cond.label}
                                        </div>
                                        <div style={{ fontSize: 10, color: colorMap[cond.color], fontWeight: 700 }}>
                                          {cond.action}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Photo button */}
                                {needsPhoto && (
                                  <div style={{ padding: '5px 8px', display: 'flex', gap: 4, borderBottom: `1px solid ${BRAND.grayBorder}` }}>
                                    {pf?.photo && (
                                      <img src={pf.photo} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(pf.photo, '_blank')} />
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setCameraModal({ key, pos }); }} style={{ flex: 1, borderRadius: 5, border: 'none', background: colorMap[pf.color], padding: '3px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); posUploadInputRefs.current[posRefKey]?.click(); }} style={{ flex: 1, borderRadius: 5, border: 'none', background: '#6B7280', padding: '3px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    </button>
                                    <input ref={(el) => { posUploadInputRefs.current[posRefKey] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePositionPhotoCapture(key, pos, e)} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {/* No Damage section */}
                    <div
                      onClick={() => handleNoDamage(item.name)}
                      style={{
                        padding: '13px 16px',
                        cursor: 'pointer',
                        background: isNoDamage ? bgColorMap.green : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isNoDamage ? colorMap.green : BRAND.grayBorder}`,
                        background: isNoDamage ? colorMap.green : BRAND.white,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: BRAND.white, fontSize: 13, fontWeight: 700,
                        transition: 'all 0.15s',
                      }}>
                        {isNoDamage && '✓'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isNoDamage ? colorMap.green : BRAND.black }}>
                          {greenCond ? greenCond.label : 'No Damage'}
                        </div>
                        <div style={{ fontSize: 11, color: colorMap.green, fontWeight: 600 }}>
                          All positions — {greenCond ? greenCond.action : 'Good'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                /* Standard condition list for non-position items */
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {item.conditions.map((cond, ci) => {
                    const selected = item.multiSelect
                      ? (finding?.conditionIdxs?.includes(ci) ?? false)
                      : finding?.conditionIdx === ci;
                    return (
                      <div
                        key={ci}
                        style={{
                          borderBottom: ci < item.conditions.length - 1 ? `1px solid ${BRAND.grayBorder}` : 'none',
                          background: selected ? bgColorMap[cond.color] : 'transparent',
                          borderLeft: selected ? `4px solid ${colorMap[cond.color]}` : '4px solid transparent',
                          transition: 'background 0.15s, border-left 0.15s',
                        }}
                      >
                        <div
                          onClick={() => item.multiSelect ? selectMultiCondition(item.name, ci) : selectCondition(item.name, ci)}
                          style={{
                            padding: '16px 18px', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between',
                            minHeight: 56,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                              border: `2.5px solid ${selected ? colorMap[cond.color] : BRAND.grayBorder}`,
                              background: selected ? colorMap[cond.color] : BRAND.white,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: BRAND.white, fontSize: 15, fontWeight: 700,
                              transition: 'all 0.15s',
                              boxShadow: selected ? `0 2px 8px ${colorMap[cond.color]}33` : 'none',
                            }}>
                              {selected && '✓'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: selected ? 700 : 500, color: selected ? colorMap[cond.color] : BRAND.black, display: 'block' }}>
                                {cond.label}
                              </span>
                              {cond.description && (
                                <span style={{ fontSize: 12, color: BRAND.gray, fontWeight: 400, lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                                  {cond.description}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{
                            padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: 13,
                            background: selected ? colorMap[cond.color] : BRAND.grayLight,
                            color: selected ? BRAND.white : BRAND.gray,
                            minWidth: 80, textAlign: 'center', transition: 'all 0.15s',
                            textTransform: 'uppercase', letterSpacing: 0.5,
                          }}>
                            {cond.action}
                          </div>
                        </div>
                        {selected && cond.subOptions?.length > 0 && (
                          <div style={{ padding: '0 18px 14px 58px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gray, marginBottom: 8 }}>
                              Type of contamination:
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {cond.subOptions.map((opt) => {
                                const picked = finding?.subOption === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={(e) => { e.stopPropagation(); selectSubOption(item.name, opt); }}
                                    style={{
                                      padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                                      border: `2px solid ${picked ? colorMap[cond.color] : BRAND.grayBorder}`,
                                      background: picked ? colorMap[cond.color] : BRAND.white,
                                      color: picked ? BRAND.white : BRAND.black,
                                      fontWeight: 700, fontSize: 13,
                                    }}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="inspection-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: BRAND.white,
          borderTop: `2px solid ${BRAND.grayBorder}`,
          padding: '12px 20px',
          zIndex: 99,
        }}
      >
        {attempted && !allFilled && (
          <p style={{
            color: BRAND.red,
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            margin: '0 0 8px',
          }}>
            Please complete all items before proceeding.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <PrimaryButton
            onClick={
              isFirst
                ? onBack
                : () => { setAttempted(false); window.scrollTo({ top: 0, behavior: 'instant' }); setCurrentCategoryIdx(currentCategoryIdx - 1); }
            }
            variant="secondary"
          >
            ← Back
          </PrimaryButton>
          <PrimaryButton onClick={handleNext}>
            {isLast ? 'Finish Inspection →' : 'Next Category →'}
          </PrimaryButton>
        </div>
      </div>

      {/* Camera modal */}
      {cameraModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: '#000',
          display: 'flex', flexDirection: 'column',
          height: '100%', maxHeight: '-webkit-fill-available',
        }}>
          {/* Top bar with close button — always visible */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.7)',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Take Photo</span>
            <button
              onClick={closeCamera}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, fontWeight: 700,
                padding: '8px 16px', cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Video feed */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Bottom capture bar — always visible */}
          <div style={{
            flexShrink: 0,
            padding: '20px 24px',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            background: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}>
            <button
              onClick={closeCamera}
              style={{
                flex: 1, padding: '16px 0', borderRadius: 14,
                background: '#333', color: '#fff', border: 'none',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                maxWidth: 140,
              }}
            >
              Cancel
            </button>
            <button
              onClick={capturePhoto}
              style={{
                flex: 2, padding: '18px 0', borderRadius: 14,
                background: BRAND.yellow, color: BRAND.black,
                border: 'none', fontSize: 17, fontWeight: 900,
                cursor: 'pointer', maxWidth: 220,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Capture
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TechCommentScreen({ comment, setComment, onFinish, onBack }) {
  const [attempted, setAttempted] = useState(false);

  const handleFinish = () => {
    if (!comment.trim()) { setAttempted(true); return; }
    onFinish();
  };

  return (
    <div className="form-screen">
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: BRAND.black,
          marginBottom: 4,
        }}
      >
        Technician Comment
      </h2>
      <p style={{ color: BRAND.gray, fontSize: 14, marginBottom: 24 }}>
        Add any additional notes or observations
      </p>
      <div
        style={{
          background: BRAND.white,
          borderRadius: 16,
          padding: 24,
          border: `2px solid ${attempted && !comment.trim() ? BRAND.red : BRAND.grayBorder}`,
        }}
      >
        <textarea
          value={comment}
          onChange={(e) => { setComment(e.target.value); setAttempted(false); }}
          placeholder="Type your comment or observations here..."
          style={{
            width: '100%',
            minHeight: 180,
            padding: '14px 16px',
            border: `2px solid ${attempted && !comment.trim() ? BRAND.red : BRAND.grayBorder}`,
            borderRadius: 12,
            fontSize: 16,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.target.style.borderColor = attempted && !comment.trim() ? BRAND.red : BRAND.yellow)}
          onBlur={(e) => (e.target.style.borderColor = attempted && !comment.trim() ? BRAND.red : BRAND.grayBorder)}
        />
        {attempted && !comment.trim() && (
          <p style={{ color: BRAND.red, fontSize: 13, fontWeight: 700, margin: '8px 0 0' }}>
            Technician comment is required.
          </p>
        )}
        <p style={{ marginTop: 12, fontSize: 12, color: BRAND.gray, margin: '12px 0 0' }}>
          Be specific about any findings or recommendations.
        </p>
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 20,
        }}
      >
        <PrimaryButton onClick={onBack} variant="secondary">
          Back
        </PrimaryButton>
        <PrimaryButton onClick={handleFinish}>
          Finish Vehicle Inspection
        </PrimaryButton>
      </div>
    </div>
  );
}

function SubmitModal({ onCancel, onConfirm }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: BRAND.white,
          borderRadius: 20,
          padding: '40px 36px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="12" fill="#16A34A"/>
            <path d="M7 12.5L10.5 16L17 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: BRAND.black,
            marginBottom: 8,
          }}
        >
          Submit Inspection?
        </h3>
        <p style={{ color: BRAND.gray, fontSize: 15, marginBottom: 28 }}>
          Are you sure you want to finish this inspection? This action cannot be
          undone.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <PrimaryButton onClick={onCancel} variant="secondary">
            Cancel
          </PrimaryButton>
          <PrimaryButton onClick={onConfirm}>Confirm</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORT GENERATION SCREEN
// ============================================================
const REPORT_COLUMNS = [
  { key: 'rif',          label: 'RIF #',          get: (ins) => ins.rif },
  { key: 'date',         label: 'Date',            get: (ins) => ins.date },
  { key: 'customerName', label: 'Customer Name',   get: (ins) => ins.customerName },
  { key: 'mobile',       label: 'Mobile No',       get: (ins) => ins.customerData?.mobileNo || '' },
  { key: 'email',        label: 'Email',           get: (ins) => ins.customerData?.email || '' },
  { key: 'company',      label: 'Company / Fleet', get: (ins) => ins.customerData?.company || '' },
  { key: 'make',         label: 'Make',            get: (ins) => ins.customerData?.make || '' },
  { key: 'model',        label: 'Model',           get: (ins) => ins.customerData?.model || '' },
  { key: 'year',         label: 'Year',            get: (ins) => ins.customerData?.year || '' },
  { key: 'plate',        label: 'Plate No',        get: (ins) => ins.customerData?.plateNo || '' },
  { key: 'transmission', label: 'Transmission',    get: (ins) => ins.customerData?.transmission || '' },
  { key: 'fuel',         label: 'Fuel Type',       get: (ins) => ins.customerData?.fuelType || '' },
  { key: 'km',           label: 'KM Reading',      get: (ins) => ins.customerData?.kmReading || '' },
  { key: 'location',     label: 'Location',        get: (ins) => [ins.customerData?.barangay, ins.customerData?.city].filter(Boolean).join(', ') },
  { key: 'package',      label: 'Package',         get: (ins) => ({ quick: 'Quick', express: 'Express', plus: 'Premium' }[ins.packageType] || ins.packageType || '') },
  { key: 'technician',   label: 'Technician',      get: (ins) => ins.technicianName || '' },
  { key: 'status',       label: 'Status',          get: (ins) => ({ draft: 'Draft', in_progress: 'In Progress', finished: 'Finished', submitted: 'Finished', reviewed: 'Finished' }[ins.status] || ins.status || '') },
  { key: 'good',         label: 'Good Count',      get: (ins) => { const v = []; Object.values(ins.findings || {}).forEach((f) => { if (f.positions) Object.values(f.positions).forEach((p) => v.push(p)); else v.push(f); }); return v.filter((f) => f.color === 'green').length; } },
  { key: 'warning',      label: 'Warning Count',   get: (ins) => { const v = []; Object.values(ins.findings || {}).forEach((f) => { if (f.positions) Object.values(f.positions).forEach((p) => v.push(p)); else v.push(f); }); return v.filter((f) => f.color === 'yellow').length; } },
  { key: 'critical',     label: 'Critical Count',  get: (ins) => { const v = []; Object.values(ins.findings || {}).forEach((f) => { if (f.positions) Object.values(f.positions).forEach((p) => v.push(p)); else v.push(f); }); return v.filter((f) => f.color === 'red').length; } },
  { key: 'techComment',  label: 'Tech Comment',    get: (ins) => ins.techComment || '' },
];

const DEFAULT_COLS = ['rif', 'date', 'customerName', 'plate', 'package', 'technician', 'status', 'good', 'warning', 'critical'];

function ReportScreen({ inspections, technicians, onBack }) {
  const [selectedCols, setSelectedCols] = useState(DEFAULT_COLS);
  const [filterPkg, setFilterPkg] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' | 'excel'
  const [downloading, setDownloading] = useState(false);

  const toggleCol = (key) => {
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const activeCols = REPORT_COLUMNS.filter((c) => selectedCols.includes(c.key));

  const filteredData = inspections.filter((ins) => {
    if (filterPkg && ins.packageType !== filterPkg) return false;
    if (filterTech && ins.technicianName !== filterTech) return false;
    if (filterStatus && ins.status !== filterStatus) return false;
    return true;
  });

  const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Shared print-quality HTML ────────────────────────────
  const buildReportHTML = (forPrint = false) => {
    const thStyle = forPrint
      ? 'padding:6px 8px;background:#1A1A1A;color:#FFD100;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;'
      : 'padding:7px 10px;background:#1A1A1A;color:#FFD100;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;';
    const headerCells = activeCols.map((c) => `<th style="${thStyle}">${c.label}</th>`).join('');
    const rows = filteredData.map((ins, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#F9FAFB';
      const cells = activeCols.map((c) => {
        const val = String(c.get(ins));
        // Color-code status and counts for print readability
        let extra = '';
        if (c.key === 'status') {
          const color = { Draft: '#6B7280', 'In Progress': '#D97706', Finished: '#16A34A' }[val] || '#1A1A1A';
          extra = `color:${color};font-weight:700;`;
        }
        if (c.key === 'good') extra = 'color:#16A34A;font-weight:700;';
        if (c.key === 'warning') extra = 'color:#D97706;font-weight:700;';
        if (c.key === 'critical') extra = 'color:#DC2626;font-weight:700;';
        return `<td style="padding:${forPrint ? '5px 8px' : '6px 10px'};border-bottom:1px solid #E5E7EB;font-size:${forPrint ? '10px' : '12px'};color:#1A1A1A;${extra}">${val}</td>`;
      }).join('');
      return `<tr style="background:${bg};">${cells}</tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Rapide Inspection Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1A1A1A; background: #fff; }
    @media print {
      body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 landscape; margin: 8mm 10mm; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body style="padding:${forPrint ? '0' : '20px'}">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #FFD100;">
    <div style="background:#FFD100;padding:8px 16px;border-radius:6px;flex-shrink:0;">
      <div style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapidé</div>
    </div>
    <div>
      <div style="font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Inspection Report</div>
      <div style="font-size:11px;color:#6B7280;margin-top:3px;">Generated ${dateStr} &bull; ${filteredData.length} record${filteredData.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="no-print" style="margin-left:auto;">
      <button onclick="window.print()" style="padding:8px 20px;background:#1A1A1A;color:#FFD100;border:none;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;">Print</button>
    </div>
  </div>
  ${filteredData.length === 0
    ? '<p style="text-align:center;color:#9CA3AF;padding:40px;">No records match the selected filters.</p>'
    : `<div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }
  <div style="margin-top:16px;font-size:10px;color:#9CA3AF;text-align:right;border-top:1px solid #E5E7EB;padding-top:8px;">
    Rapidé Auto Service Experts &bull; Digital Inspection System
  </div>
</body>
</html>`;
  };

  // ── Print ────────────────────────────────────────────────
  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(buildReportHTML(true));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  // ── Export PDF ───────────────────────────────────────────
  const handleExportPDF = async () => {
    setDownloading(true);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1100px;background:white;padding:24px;font-family:Arial,sans-serif;box-sizing:border-box;';
    const html = buildReportHTML(false);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    container.innerHTML = bodyMatch ? bodyMatch[1] : '';
    container.querySelectorAll('.no-print').forEach((el) => el.remove());
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, width: 1100 });
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentW = pageW - margin * 2;
      const imgHeightMm = (canvas.height * contentW) / canvas.width;
      let srcY = 0, remaining = imgHeightMm, first = true;
      while (remaining > 0) {
        if (!first) pdf.addPage();
        first = false;
        const sliceMm = Math.min(remaining, pageH - margin * 2);
        const slicePx = Math.round((sliceMm / imgHeightMm) * canvas.height);
        const sc = document.createElement('canvas');
        sc.width = canvas.width; sc.height = slicePx;
        sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
        pdf.addImage(sc.toDataURL('image/jpeg', 0.93), 'JPEG', margin, margin, contentW, sliceMm);
        srcY += slicePx; remaining -= sliceMm;
      }
      pdf.save(`Rapide-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      document.body.removeChild(container);
      setDownloading(false);
    }
  };

  // ── Export Excel (CSV) ───────────────────────────────────
  const handleExportExcel = () => {
    const headers = activeCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const rows = filteredData.map((ins) =>
      activeCols.map((c) => {
        const val = String(c.get(ins)).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\r\n');
    // BOM (\ufeff) ensures Excel opens UTF-8 correctly
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapide-Report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportFormat === 'pdf') handleExportPDF();
    else handleExportExcel();
  };

  const filterSelectStyle = {
    minHeight: 40, padding: '8px 12px', border: `2px solid ${BRAND.grayBorder}`,
    borderRadius: 10, fontSize: 13, background: BRAND.white, flex: 1,
  };

  const disabled = activeCols.length === 0 || filteredData.length === 0;

  return (
    <div className="form-screen" style={{ paddingBottom: 40 }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: BRAND.black, marginBottom: 4 }}>Report Generation</h2>
      <p style={{ color: BRAND.gray, fontSize: 14, marginBottom: 24 }}>
        Choose columns, filters, and export format.
      </p>

      {/* Column selector */}
      <div style={{ background: BRAND.white, borderRadius: 14, border: `2px solid ${BRAND.grayBorder}`, padding: '20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Columns</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedCols(REPORT_COLUMNS.map((c) => c.key))} style={{ fontSize: 12, fontWeight: 700, color: BRAND.gray, background: 'none', border: 'none', cursor: 'pointer' }}>Select All</button>
            <span style={{ color: BRAND.grayBorder }}>|</span>
            <button onClick={() => setSelectedCols([])} style={{ fontSize: 12, fontWeight: 700, color: BRAND.gray, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {REPORT_COLUMNS.map((col) => {
            const checked = selectedCols.includes(col.key);
            return (
              <label key={col.key} onClick={() => toggleCol(col.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${checked ? BRAND.yellow : BRAND.grayBorder}`, background: checked ? BRAND.yellowPale : BRAND.white, transition: 'all 0.15s' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${checked ? BRAND.black : BRAND.grayBorder}`, background: checked ? BRAND.black : BRAND.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#FFD100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: BRAND.black }}>{col.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: BRAND.white, borderRadius: 14, border: `2px solid ${BRAND.grayBorder}`, padding: '20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Filters</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={filterPkg} onChange={(e) => setFilterPkg(e.target.value)} style={filterSelectStyle}>
            <option value="">All Packages</option>
            <option value="quick">Quick</option>
            <option value="express">Express</option>
            <option value="plus">Premium Plus</option>
          </select>
          <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} style={filterSelectStyle}>
            <option value="">All Technicians</option>
            {technicians.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={filterSelectStyle}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="finished">Finished</option>
          </select>
        </div>
      </div>

      {/* Export Format */}
      <div style={{ background: BRAND.white, borderRadius: 14, border: `2px solid ${BRAND.grayBorder}`, padding: '20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Export Format</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'pdf', label: 'PDF', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            ), desc: 'Download as PDF file' },
            { key: 'excel', label: 'Excel', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/>
              </svg>
            ), desc: 'Download as .csv (opens in Excel)' },
          ].map((fmt) => {
            const sel = exportFormat === fmt.key;
            return (
              <button
                key={fmt.key}
                onClick={() => setExportFormat(fmt.key)}
                style={{
                  flex: '1 1 140px', minWidth: 140, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${sel ? BRAND.black : BRAND.grayBorder}`,
                  background: sel ? BRAND.black : BRAND.white,
                  color: sel ? BRAND.yellow : BRAND.black,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                {fmt.icon}
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>{fmt.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: sel ? '#ccc' : BRAND.gray }}>{fmt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div style={{ background: BRAND.white, borderRadius: 14, border: `2px solid ${BRAND.grayBorder}`, padding: '20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>
          Preview{' '}
          <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.gray }}>({filteredData.length} record{filteredData.length !== 1 ? 's' : ''})</span>
        </h3>
        {activeCols.length === 0 ? (
          <p style={{ color: BRAND.gray, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Select at least one column to preview.</p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${BRAND.grayBorder}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: BRAND.black }}>
                  {activeCols.map((c) => (
                    <th key={c.key} style={{ padding: '10px 12px', textAlign: 'left', color: BRAND.yellow, fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 && (
                  <tr><td colSpan={activeCols.length} style={{ padding: 32, textAlign: 'center', color: BRAND.gray }}>No records match the selected filters.</td></tr>
                )}
                {filteredData.slice(0, 10).map((ins, i) => (
                  <tr key={ins.rif} style={{ background: i % 2 === 0 ? BRAND.white : BRAND.grayLight }}>
                    {activeCols.map((c) => (
                      <td key={c.key} style={{ padding: '9px 12px', borderBottom: `1px solid ${BRAND.grayBorder}`, fontSize: 12, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(c.get(ins))}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredData.length > 10 && (
                  <tr><td colSpan={activeCols.length} style={{ padding: '10px 12px', textAlign: 'center', color: BRAND.gray, fontSize: 12, fontStyle: 'italic' }}>
                    Showing 10 of {filteredData.length} records — all records included in export.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <PrimaryButton onClick={onBack} variant="secondary">← Back</PrimaryButton>
        <PrimaryButton onClick={handlePrint} variant="secondary" disabled={disabled}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print
        </PrimaryButton>
        <PrimaryButton onClick={handleExport} disabled={disabled || downloading}>
          {downloading ? 'Generating...' : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
            </>
          )}
        </PrimaryButton>
      </div>
    </div>
  );
}

function AdminDashboard({
  inspections,
  onView,
  onResume,
  onNewInspection,
  onDelete,
  technicians,
}) {
  const [search, setSearch] = useState('');
  const [filterPkg, setFilterPkg] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { rif, customerName }

  const filtered = inspections.filter((ins) => {
    if (
      search &&
      !(ins.rif + ' ' + ins.customerName + ' ' + ins.technicianName + ' ' + (ins.customerData?.plateNo || ''))
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    if (filterPkg && ins.packageType !== filterPkg) return false;
    if (filterTech && ins.technicianName !== filterTech) return false;
    if (filterStatus && ins.status !== filterStatus) return false;
    return true;
  });

  const pkgLabel = { quick: 'QUICK', express: 'EXPRESS', plus: 'PREMIUM' };
  const pkgColor = {
    quick: BRAND.green,
    express: BRAND.yellowStatus,
    plus: BRAND.red,
  };

  const statusLabel = { draft: 'Draft', in_progress: 'In Progress', finished: 'Finished', submitted: 'Finished', reviewed: 'Finished' };
  const statusColor = { draft: BRAND.gray, in_progress: BRAND.yellowStatus, finished: BRAND.green, submitted: BRAND.green, reviewed: BRAND.green };
  const statusBg = { draft: BRAND.grayLight, in_progress: BRAND.yellowStatusBg, finished: BRAND.greenBg, submitted: BRAND.greenBg, reviewed: BRAND.greenBg };

  const finishedCount = inspections.filter((i) => ['finished', 'submitted', 'reviewed'].includes(i.status)).length;
  const inProgressCount = inspections.filter((i) => i.status === 'in_progress').length;
  const draftCount = inspections.filter((i) => i.status === 'draft').length;

  return (
    <div className="form-screen">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: BRAND.black,
              margin: 0,
            }}
          >
            Dashboard
          </h2>
          <p
            style={{ color: BRAND.gray, fontSize: 14, margin: 0, marginTop: 4 }}
          >
            {finishedCount} finished · {inProgressCount} in progress · {draftCount} draft
          </p>
        </div>
        <PrimaryButton
          onClick={onNewInspection}
          style={{ fontSize: 12, padding: '8px 14px', minHeight: 40 }}
        >
          + New Inspection
        </PrimaryButton>
      </div>

      {/* Filters */}
      <div
        className="dashboard-filters"
        style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}
      >
        <input
          placeholder="Search RIF, customer, technician, plate no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            minHeight: 44,
            padding: '8px 14px',
            border: `2px solid ${BRAND.grayBorder}`,
            borderRadius: 10,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <select
          value={filterPkg}
          onChange={(e) => setFilterPkg(e.target.value)}
          style={{
            minHeight: 44,
            padding: '8px 14px',
            border: `2px solid ${BRAND.grayBorder}`,
            borderRadius: 10,
            fontSize: 14,
            background: BRAND.white,
          }}
        >
          <option value="">All Packages</option>
          <option value="quick">Quick</option>
          <option value="express">Express</option>
          <option value="plus">Premium</option>
        </select>
        <select
          value={filterTech}
          onChange={(e) => setFilterTech(e.target.value)}
          style={{
            minHeight: 44,
            padding: '8px 14px',
            border: `2px solid ${BRAND.grayBorder}`,
            borderRadius: 10,
            fontSize: 14,
            background: BRAND.white,
          }}
        >
          <option value="">All Technicians</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            minHeight: 44,
            padding: '8px 14px',
            border: `2px solid ${BRAND.grayBorder}`,
            borderRadius: 10,
            fontSize: 14,
            background: BRAND.white,
          }}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="finished">Finished</option>
        </select>
      </div>

      {/* Table */}
      <div className="dashboard-table-wrap">
        <table
          className="dashboard-table"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: BRAND.black }}>
              {[
                { label: 'RIF #', cls: '' },
                { label: 'Date', cls: 'col-date' },
                { label: 'Customer', cls: '' },
                { label: 'Plate No', cls: 'col-plate' },
                { label: 'Technician', cls: 'col-technician' },
                { label: 'Package', cls: '' },
                { label: 'Status', cls: '' },
                { label: 'Actions', cls: '' },
              ].map(({ label, cls }) => (
                <th
                  key={label}
                  className={cls}
                  style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    color: BRAND.yellow,
                    fontWeight: 800,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: BRAND.gray,
                  }}
                >
                  No inspections found
                </td>
              </tr>
            )}
            {filtered.map((ins, i) => {
              const isResumable = ins.status === 'draft' || ins.status === 'in_progress';
              return (
                <tr
                  key={ins.rif}
                  style={{
                    background: i % 2 === 0 ? BRAND.white : BRAND.grayLight,
                    cursor: 'pointer',
                  }}
                  onClick={() => isResumable ? onResume(ins) : onView(ins)}
                >
                  <td
                    style={{
                      padding: '14px 16px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    {ins.rif}
                  </td>
                  <td className="col-date" style={{ padding: '14px 16px' }}>{ins.date}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                    {ins.customerName}
                  </td>
                  <td className="col-plate" style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700 }}>{ins.customerData?.plateNo || '—'}</td>
                  <td className="col-technician" style={{ padding: '14px 16px' }}>{ins.technicianName}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        background: pkgColor[ins.packageType] + '20',
                        color: pkgColor[ins.packageType],
                        textTransform: 'uppercase',
                      }}
                    >
                      {pkgLabel[ins.packageType]}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        background: statusBg[ins.status] || BRAND.grayLight,
                        color: statusColor[ins.status] || BRAND.gray,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {statusLabel[ins.status] || ins.status}
                    </span>
                  </td>
                  <td className="action-cell" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isResumable ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onResume(ins); }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            border: `1px solid ${BRAND.yellowStatus}`,
                            background: BRAND.yellowStatusBg,
                            color: BRAND.black,
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); onView(ins); }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            border: `1px solid ${BRAND.yellow}`,
                            background: BRAND.yellowPale,
                            color: BRAND.black,
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                      )}
                      {ins.status === 'draft' && <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ rif: ins.rif, customerName: ins.customerName });
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: `1px solid #fca5a5`,
                          background: '#fef2f2',
                          color: '#DC2626',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="12" fill="#DC2626"/>
                <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: BRAND.black, marginBottom: 8 }}>Delete Inspection?</div>
            <div style={{ fontSize: 14, color: BRAND.gray, marginBottom: 6 }}>
              You are about to delete this draft inspection. This action cannot be undone.
            </div>
            <div style={{ display: 'inline-block', background: BRAND.grayLight, borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 700, color: BRAND.black, marginBottom: 28, fontFamily: 'monospace' }}>
              RIF: {deleteTarget.rif}{deleteTarget.customerName ? ` · ${deleteTarget.customerName}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: BRAND.grayLight, color: BRAND.black, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(deleteTarget.rif); setDeleteTarget(null); }}
                style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: '#DC2626', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceDecisionScreen({ inspection, onSave, onBack }) {
  const [decisions, setDecisions] = useState({});

  // Get yellow and red findings — handle both normal and per-position findings
  const actionable = [];
  if (inspection.findings) {
    const categories = INSPECTION_DATA[inspection.packageType] || [];
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const key = `${cat.category}::${item.name}`;
        const finding = inspection.findings[key];
        if (!finding) return;
        if (item.hasPosition && finding.positions) {
          item.positions.forEach((pos) => {
            const pf = finding.positions[pos];
            if (pf && (pf.color === 'yellow' || pf.color === 'red')) {
              actionable.push({ category: cat.category, item: `${item.name} (${pos})`, ...pf });
            }
          });
        } else if (finding.color === 'yellow' || finding.color === 'red') {
          actionable.push({ category: cat.category, item: item.name, ...finding });
        }
      });
    });
  }

  // Count all individual findings including per-position
  const allFindingValues = [];
  Object.values(inspection.findings || {}).forEach((f) => {
    if (f.positions) Object.values(f.positions).forEach((pf) => allFindingValues.push(pf));
    else allFindingValues.push(f);
  });
  const greenCount = allFindingValues.filter((f) => f.color === 'green').length;
  const yellowCount = actionable.filter((f) => f.color === 'yellow').length;
  const redCount = actionable.filter((f) => f.color === 'red').length;

  const updateDecision = (key, field, value) => {
    setDecisions((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = () => {
    // Validate red declined items need reason
    let valid = true;
    actionable.forEach((f) => {
      const key = `${f.category}::${f.item}`;
      const dec = decisions[key];
      if (
        f.color === 'red' &&
        (!dec || !dec.proceed) &&
        (!dec || !dec.reason)
      ) {
        valid = false;
      }
    });
    if (!valid) {
      alert('All declined RED items require a decline reason.');
      return;
    }
    onSave(decisions);
  };

  const buildSummaryHTML = () => {
    const findings = inspection.findings || {};
    const categories = INSPECTION_DATA[inspection.packageType] || [];
    const pkgLabel = { quick: 'QUICK', express: 'EXPRESS', plus: 'PREMIUM PLUS' };

    const badge = (pf) => {
      if (!pf) return '—';
      const color = pf.color === 'green' ? '#16A34A' : pf.color === 'yellow' ? '#D97706' : '#DC2626';
      const bg = pf.color === 'green' ? '#DCFCE7' : pf.color === 'yellow' ? '#FEF3C7' : '#FEE2E2';
      return `<span style="display:inline-block;padding:4px 14px;border-radius:4px;color:${color};font-weight:800;font-size:12px;background:${bg};letter-spacing:0.3px;">${pf.action}</span>`;
    };

    let findingsHTML = '';
    categories.forEach((cat) => {
      let rows = '';
      cat.items.forEach((item) => {
        const key = `${cat.category}::${item.name}`;
        const f = findings[key];
        if (item.hasPosition && f?.positions) {
          // Group positions by their condition
          const condGroups = {};
          item.positions.forEach((pos) => {
            const pf = f.positions[pos];
            if (!pf) return;
            const gk = pf.conditionIdx != null ? pf.conditionIdx : pf.condition;
            if (!condGroups[gk]) condGroups[gk] = { ...pf, positionList: [] };
            condGroups[gk].positionList.push(pos);
          });
          const groups = Object.values(condGroups);
          if (groups.length === 0) {
            rows += `<tr>
              <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">${item.name}</td>
              <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">—</td>
              <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;text-align:center;">—</td>
            </tr>`;
          } else {
            groups.forEach((group, gIdx) => {
              const col = group.color === 'green' ? '#16A34A' : group.color === 'yellow' ? '#D97706' : '#DC2626';
              const posBadges = group.positionList.map(p =>
                `<span style="color:${col};font-weight:700;margin-left:4px;font-size:11px;">${p}</span>`
              ).join('');
              rows += `<tr>
                <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">${gIdx === 0 ? item.name : ''}</td>
                <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;"><span style="color:${col};">${group.condition}</span>${posBadges}</td>
                <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;text-align:center;"><strong style="color:${col};">${group.action}</strong></td>
              </tr>`;
            });
          }
        } else {
          rows += `<tr>
            <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">${item.name}</td>
            <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">${f ? f.condition : '—'}</td>
            <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;text-align:center;">${badge(f)}</td>
          </tr>`;
        }
      });
      findingsHTML += `
        <div style="margin-top:12px;">
          <div style="background:#1A1A1A;color:#FFD100;padding:8px 14px;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1px;border-radius:4px 4px 0 0;">${cat.category}</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:11px;font-weight:700;">ITEM</th>
              <th style="padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:11px;font-weight:700;">CONDITION</th>
              <th style="padding:6px 10px;border:1px solid #ccc;text-align:center;font-size:11px;font-weight:700;">ACTION</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    });

    // Collect photos from all findings
    const photos = [];
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const key = `${cat.category}::${item.name}`;
        const f = findings[key];
        if (f?.photo) {
          photos.push({ category: cat.category, name: item.name, photo: f.photo, color: f.color, action: f.action });
        }
      });
    });

    let photosPageHTML = '';
    if (photos.length > 0) {
      const photoCards = photos.map((p) => {
        const borderColor = p.color === 'red' ? '#E31E24' : '#F59E0B';
        const bgColor = p.color === 'red' ? '#FEE2E2' : '#FEF3C7';
        const textColor = p.color === 'red' ? '#DC2626' : '#D97706';
        return `
          <div style="border:2px solid ${borderColor};border-radius:8px;overflow:hidden;break-inside:avoid;">
            <img src="${p.photo}" style="width:100%;height:200px;object-fit:cover;display:block;" />
            <div style="padding:10px 12px;background:${bgColor};">
              <div style="font-size:13px;font-weight:800;color:#1A1A1A;">${p.name}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:2px;text-transform:uppercase;letter-spacing:0.4px;">${p.category}</div>
              <span style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:4px;background:${borderColor};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${p.action}</span>
            </div>
          </div>`;
      }).join('');

      photosPageHTML = `
        <div style="page-break-before:always;padding-top:8px;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="background:#FFD100;padding:12px 24px;border-radius:8px;display:inline-block;margin-bottom:12px;">
              <div style="font-family:'Arial Black',sans-serif;font-size:28px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapidé</div>
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
            </div>
            <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1A1A1A;">Inspection Photo Documentation</div>
            <div style="font-size:12px;color:#6B7280;margin-top:4px;">Visual documentation of flagged inspection items &mdash; ${inspection.rif}</div>
            <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${inspection.customerData?.make || ''} ${inspection.customerData?.model || ''} ${inspection.customerData?.year || ''} &bull; ${inspection.customerData?.plateNo || ''} &bull; ${inspection.date}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
            ${photoCards}
          </div>
        </div>`;
    }

    const logoBlock = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="background:#FFD100;padding:16px;border-radius:8px;display:inline-block;">
          <div style="font-family:'Arial Black',sans-serif;font-size:32px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapid&#233;</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
        </div>
      </div>`;

    return `<!DOCTYPE html><html><head><title>Rapide Inspection - ${inspection.rif}</title>
      <style>
        @media print { body { margin: 0; } @page { size: A4 portrait; margin: 12mm; } }
        body { font-family: Arial, sans-serif; margin: 20px; color: #1A1A1A; }
      </style>
    </head><body>
      ${logoBlock}
      <div style="text-align:center;margin-bottom:16px;"><strong style="font-size:16px;">VEHICLE INSPECTION REPORT</strong></div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>RIF #:</strong> ${inspection.rif}</td>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Date:</strong> ${inspection.date}</td>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Package:</strong> ${pkgLabel[inspection.packageType]}</td>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Technician:</strong> ${inspection.technicianName}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ccc;">
        <tr style="background:#f5f5f5;"><td colspan="4" style="padding:8px 10px;font-weight:800;font-size:13px;">VEHICLE INFORMATION</td></tr>
        <tr>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Make:</strong> ${inspection.customerData?.make || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Model:</strong> ${inspection.customerData?.model || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Year:</strong> ${inspection.customerData?.year || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Plate:</strong> ${inspection.customerData?.plateNo || ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Trans:</strong> ${inspection.customerData?.transmission || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Fuel:</strong> ${inspection.customerData?.fuelType || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;" colspan="2"><strong>KM:</strong> ${inspection.customerData?.kmReading || ''}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ccc;">
        <tr style="background:#f5f5f5;"><td colspan="4" style="padding:8px 10px;font-weight:800;font-size:13px;">CUSTOMER INFORMATION</td></tr>
        <tr>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Name:</strong> ${inspection.customerData?.title || ''} ${inspection.customerData?.firstName || ''} ${inspection.customerData?.lastName || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Mobile:</strong> ${inspection.customerData?.mobileNo || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;" colspan="2"><strong>Email:</strong> ${inspection.customerData?.email || ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Company:</strong> ${inspection.customerData?.company || ''}</td>
          <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;" colspan="3"><strong>Location:</strong> ${inspection.customerData?.barangay || ''}, ${inspection.customerData?.city || ''}</td>
        </tr>
      </table>
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div style="flex:1;text-align:center;padding:10px;background:#DCFCE7;border-radius:6px;"><div style="font-size:24px;font-weight:900;color:#22C55E;">${greenCount}</div><div style="font-size:11px;font-weight:700;color:#22C55E;">GOOD</div></div>
        <div style="flex:1;text-align:center;padding:10px;background:#FEF3C7;border-radius:6px;"><div style="font-size:24px;font-weight:900;color:#F59E0B;">${yellowCount}</div><div style="font-size:11px;font-weight:700;color:#F59E0B;">WARNING</div></div>
        <div style="flex:1;text-align:center;padding:10px;background:#FEE2E2;border-radius:6px;"><div style="font-size:24px;font-weight:900;color:#E31E24;">${redCount}</div><div style="font-size:11px;font-weight:700;color:#E31E24;">CRITICAL</div></div>
      </div>
      ${findingsHTML}
      ${inspection.techComment ? `<div style="margin-top:16px;padding:12px;border:1px solid #ccc;border-radius:6px;"><strong style="font-size:12px;">Technician Comment:</strong><div style="font-size:12px;margin-top:4px;">${inspection.techComment}</div></div>` : ''}
      <div style="margin-top:40px;display:flex;justify-content:space-between;">
        <div style="text-align:center;width:40%;"><div style="border-top:1px solid #1A1A1A;padding-top:4px;font-size:11px;">Customer Signature</div></div>
        <div style="text-align:center;width:40%;"><div style="border-top:1px solid #1A1A1A;padding-top:4px;font-size:11px;">Authorized by</div></div>
      </div>
      ${photosPageHTML}
    </body></html>`;
  };

  const printInspection = () => {
    const formHTML = inspection.packageType === 'express'
      ? buildExpressFormHTML()
      : inspection.packageType === 'plus'
        ? buildPlusFormHTML()
        : buildQuickFormHTML();

    const photosHTML = buildPhotosPageHTML();

    // Extract body content from form HTML
    const formBody = (formHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i) || ['', formHTML])[1];
    const photosBody = photosHTML
      ? (photosHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i) || ['', photosHTML])[1]
      : '';

    const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        @media print { body { margin: 0; } @page { size: A4 portrait; margin: 8mm; } }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
        .photos-page { page-break-before: always; }
      </style>
    </head><body>
      <div>${formBody}</div>
      ${photosBody ? `<div class="photos-page">${photosBody}</div>` : ''}
      <script>
        window.addEventListener('load', function() { window.print(); });
      </script>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(combined);
    printWindow.document.close();
  };

  const buildQuickFormHTML = () => {
    const findings = inspection.findings || {};
    const cd = inspection.customerData || {};
    const sd = inspection.serviceData || {};

    const cb = (checked) =>
      checked
        ? `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;text-align:center;line-height:10px;font-size:9px;vertical-align:middle;">&#10003;</span>`
        : `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;vertical-align:middle;"></span>`;

    const battV = findings['BATTERY TEST::Battery Voltage'];
    const battVIdx = battV !== undefined ? battV.conditionIdx : -1;

    const getIdx = (key) => { const f = findings[key]; return f !== undefined ? f.conditionIdx : -1; };
    const coolantIdx = getIdx('UNDER THE HOOD::Coolant Level');
    const brakeIdx = getIdx('UNDER THE HOOD::Brake Fluid Level');
    const psIdx = getIdx('UNDER THE HOOD::Power Steering Fluid');
    const clutchIdx = getIdx('UNDER THE HOOD::Clutch Fluid');
    const battCCAIdx = getIdx('BATTERY TEST::Starting Power (CCA)');
    const noDamageAllGood = ['FL','FR','RL','RR'].every(p => findings['TIRES::No Damage']?.positions?.[p]?.conditionIdx === 0);
    const isLow = (i) => i === 1 || i === 2;
    const isFull = (i) => i === 0;

    const getTirePos = (name) => findings[`TIRES::${name}`]?.positions || {};
    const hasTireIssue = (name) => Object.values(getTirePos(name)).some(p => p.conditionIdx === 1);
    // Returns ALL inspected positions with their actual condition colors
    const tireAllPosBadges = (name) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getTirePos(name);
      return ['FL','FR','RL','RR'].flatMap(p => {
        const pd = pos[p];
        if (!pd) return [];
        const col = cvs[pd.color] || '#000';
        return [`<strong style="color:${col};">${p}</strong>`];
      }).join('&nbsp;');
    };
    // Returns action word td — prefer issue action; fall back to good action
    const tireActionTd = (name) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getTirePos(name);
      const issuePos = ['FL','FR','RL','RR'].find(p => pos[p]?.conditionIdx === 1);
      if (issuePos) {
        const pd = pos[issuePos];
        return `<td style="${T};text-align:center;"><strong style="color:${cvs[pd.color]||'#DC2626'};">${pd.action}</strong></td>`;
      }
      const goodPos = ['FL','FR','RL','RR'].find(p => pos[p]?.conditionIdx === 0);
      if (goodPos) {
        const pd = pos[goodPos];
        return `<td style="${T};text-align:center;"><strong style="color:${cvs[pd.color]||'#16A34A'};">${pd.action}</strong></td>`;
      }
      return `<td style="${T}"></td>`;
    };

    const pmsAnswer = [sd.lastPmsMonth, sd.lastPmsYear].filter(Boolean).join(' ');
    const partsAnswer = (sd.replacedParts || []).join(', ');
    const problemsAnswer = (sd.currentProblems || []).join(', ');

    const T = `border:0.5px solid #bbb;padding:3px 5px;font-size:11px;vertical-align:middle;`;
    const Ttop = `border:0.5px solid #bbb;padding:3px 5px;font-size:11px;vertical-align:top;`;

    const actionBg = (action) => {
      if (action === 'Good') return 'color:#16A34A;font-weight:700;';
      if (action === 'Replace') return 'color:#DC2626;font-weight:700;';
      return 'color:#D97706;font-weight:700;';
    };
    // Returns colored action cell only when that row is selected, plain otherwise
    const actionTd = (action, selected) =>
      `<td style="${T}${selected ? actionBg(action) : ''}">${action}</td>`;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
    <style>*{box-sizing:border-box;margin:0;padding:0;}table{border-collapse:collapse;width:100%;}</style>
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff;width:794px;padding:24px;">

    <!-- RAPIDE LOGO + BRANCH -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <div style="background:#FFD100;padding:6px 14px;border-radius:6px;display:inline-block;">
        <div style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapid&#233;</div>
        <div style="font-size:8px;font-weight:700;letter-spacing:2.5px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800;font-size:13px;color:#1A1A1A;">${cd.branch || 'Rapide San Antonio'}</div>
        <div style="font-size:9px;color:#6B7280;margin-top:2px;">Branch</div>
      </div>
    </div>

    <!-- TITLE -->
    <div style="color:#000;text-align:center;padding:6px 0 4px;font-family:'Arial Black',Arial,sans-serif;font-size:28px;font-weight:900;letter-spacing:0;line-height:1.05;margin-bottom:4px;">QUICK SAFETY INSPECTION FORM</div>

    <!-- VEHICLE DETAILS -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:3px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:11px;font-weight:700;letter-spacing:2px;">VEHICLE DETAILS</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:14%;"><col style="width:9%;"><col style="width:19%;"><col style="width:27%;"><col style="width:17%;"><col style="width:14%;"></colgroup>
        <tr>
          <td style="${T}"><strong>Model:</strong> ${cd.model || ''}</td>
          <td style="${T}"><strong>Year:</strong> ${cd.year || ''}</td>
          <td style="${T}"><strong>Make:</strong> ${cd.make || ''}</td>
          <td style="${T}"><strong>Plate No:</strong> ${cd.plateNo || ''}</td>
          <td style="${Ttop}" rowspan="2"><strong>KM Reading</strong><br>${cd.kmReading || ''}</td>
          <td style="${Ttop}" rowspan="2"><strong>Date:</strong><br>${inspection.date || ''}</td>
        </tr>
        <tr>
          <td style="${T}">${cb(cd.transmission === 'Manual')} Manual</td>
          <td style="${T}">${cb(cd.transmission === 'A/T')} A/T</td>
          <td style="${T}">${cb(cd.transmission === 'CVT')} CVT</td>
          <td style="${T};white-space:nowrap;">${cb(cd.fuelType === 'Gas')} Gas &nbsp; ${cb(cd.fuelType === 'Diesel')} Diesel &nbsp; ${cb(cd.fuelType === 'EV/HEV')} EV/HEV</td>
        </tr>
      </table>
    </div>

    <!-- CUSTOMER DETAILS -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:3px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:11px;font-weight:700;letter-spacing:2px;">CUSTOMER DETAILS</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:18%;"><col style="width:10%;"><col style="width:22%;"><col style="width:25%;"><col style="width:25%;"></colgroup>
        <tr>
          <td style="${T}" rowspan="2"><strong>Company:</strong> ${cd.company || ''}</td>
          <td style="${T}">${cb(cd.title === 'Mr')} Mr.</td>
          <td style="${T}"><strong>First Name:</strong> ${cd.firstName || ''}</td>
          <td style="${T}"><strong>Mobile No.</strong> ${cd.mobileNo || ''}</td>
          <td style="${T}"><strong>City:</strong> ${cd.city || ''}</td>
        </tr>
        <tr>
          <td style="${T}">${cb(cd.title === 'Ms')} Ms.</td>
          <td style="${T}"><strong>Last Name:</strong> ${cd.lastName || ''}</td>
          <td style="${T}"><strong>Email:</strong> ${cd.email || ''}</td>
          <td style="${T}"><strong>Barangay:</strong> ${cd.barangay || ''}</td>
        </tr>
        <tr>
          <td style="${T}" colspan="5"><strong>Branch:</strong> ${cd.branch || 'Rapide San Antonio'}</td>
        </tr>
      </table>
    </div>

    <!-- Questions -->
    <table style="margin-bottom:4px;">
      <tr>
        <td style="border:none;white-space:nowrap;padding:2px 0;font-size:11px;">1. When was your last change oil / PMS ?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:2px 0;font-size:11px;width:100%;">&nbsp;${pmsAnswer}</td>
      </tr>
      <tr>
        <td style="border:none;white-space:nowrap;padding:2px 0;font-size:11px;">2. What part/s were replaced in your last service?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:2px 0;font-size:11px;">&nbsp;${partsAnswer}</td>
      </tr>
      <tr>
        <td style="border:none;white-space:nowrap;padding:2px 0;font-size:11px;">3. Any problems with your Vehicle ATM?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:2px 0;font-size:11px;">&nbsp;${problemsAnswer}</td>
      </tr>
    </table>

    <!-- VEHICLE INSPECTION -->
    <div style="background:#1A1A1A;color:#fff;text-align:center;padding:4px 0;font-size:11px;font-weight:700;letter-spacing:2px;margin-bottom:3px;border-radius:6px;">VEHICLE INSPECTION</div>

    <!-- MEASURE -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:3px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:11px;font-weight:700;letter-spacing:1px;">MEASURE</div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <!-- LEFT: TEST BATTERY -->
          <td style="width:50%;padding:0;vertical-align:top;border:none;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:26%;"><col style="width:44%;"><col style="width:30%;"></colgroup>
              <tr>
                <td style="${T}"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="7">TEST<br>BATTERY</td>
                <td style="${Ttop}" colspan="2"><strong>Voltage Power</strong></td>
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 0)} 12.6V to 12.8 V</td>
                ${actionTd('Good', battVIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 1)} 12.2V to 12.6 V</td>
                ${actionTd('Recharge', battVIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 2)} &lt;12.2V</td>
                ${actionTd('Replace', battVIdx === 2)}
              </tr>
              <tr>
                <td style="${Ttop}" colspan="2"><strong>Starting Power (CCA)</strong></td>
              </tr>
              <tr>
                <td style="${T}">${cb(battCCAIdx === 0)} &gt;80%</td>
                ${actionTd('Good', battCCAIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(battCCAIdx === 1)} &lt;80%</td>
                ${actionTd('Replace', battCCAIdx === 1)}
              </tr>
            </table>
          </td>
          <!-- RIGHT: TIRES -->
          <td style="width:50%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:26%;"><col style="width:44%;"><col style="width:30%;"></colgroup>
              <tr>
                <td style="${T}"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="4">TIRES</td>
                <td style="${Ttop}">${cb(hasTireIssue('Bulges'))} Bulges <span style="font-size:9px;">${tireAllPosBadges('Bulges')}</span></td>
                ${tireActionTd('Bulges')}
              </tr>
              <tr>
                <td style="${Ttop}">${cb(hasTireIssue('Side Wall Cracks'))} Side Wall Cracks <span style="font-size:9px;">${tireAllPosBadges('Side Wall Cracks')}</span></td>
                ${tireActionTd('Side Wall Cracks')}
              </tr>
              <tr>
                <td style="${Ttop}">${cb(hasTireIssue('Tread <1.7mm'))} &lt;1.7 mm <span style="font-size:9px;">${tireAllPosBadges('Tread <1.7mm')}</span></td>
                ${tireActionTd('Tread <1.7mm')}
              </tr>
              <tr>
                <td style="${Ttop}">${cb(noDamageAllGood)} No Damage <span style="font-size:9px;">${tireAllPosBadges('No Damage')}</span></td>
                ${tireActionTd('No Damage')}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- INSPECT -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:3px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:11px;font-weight:700;letter-spacing:1px;">INSPECT</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:13%;"><col style="width:22%;"><col style="width:15%;"><col style="width:13%;"><col style="width:22%;"><col style="width:15%;"></colgroup>
        <tr>
          <td style="${T}"></td>
          <td style="${T};text-align:center;font-weight:700;">Condition</td>
          <td style="${T};text-align:center;font-weight:700;">Action</td>
          <td style="${T}"></td>
          <td style="${T};text-align:center;font-weight:700;">Condition</td>
          <td style="${T};text-align:center;font-weight:700;">Action</td>
        </tr>
        <tr>
          <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="2">Coolant</td>
          <td style="${T}">${cb(isLow(coolantIdx))} Low Level</td>
          ${actionTd('Top Up', isLow(coolantIdx))}
          <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="2">Brake Fluid</td>
          <td style="${T}">${cb(isLow(brakeIdx))} Low Level</td>
          ${actionTd('Top Up', isLow(brakeIdx))}
        </tr>
        <tr>
          <td style="${T}">${cb(isFull(coolantIdx))} Correct Level</td>
          ${actionTd('Good', isFull(coolantIdx))}
          <td style="${T}">${cb(isFull(brakeIdx))} Correct Level</td>
          ${actionTd('Good', isFull(brakeIdx))}
        </tr>
        <tr>
          <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="2">Power<br>Steering<br>Fluid</td>
          <td style="${T}">${cb(isLow(psIdx))} Low Level</td>
          ${actionTd('Top Up', isLow(psIdx))}
          <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="2">Clutch Fluid</td>
          <td style="${T}">${cb(clutchIdx === 1)} Low Level</td>
          ${actionTd('Top Up', clutchIdx === 1)}
        </tr>
        <tr>
          <td style="${T}">${cb(isFull(psIdx))} Correct Level</td>
          ${actionTd('Good', isFull(psIdx))}
          <td style="${T}">${cb(clutchIdx === 0)} Correct Level</td>
          ${actionTd('Good', clutchIdx === 0)}
        </tr>
      </table>
    </div>

    <!-- TECHNICIAN'S COMMENT -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:11px;font-weight:700;letter-spacing:1px;">TECHNICIAN'S COMMENT</div>
      <div style="min-height:90px;padding:6px 8px;font-size:11px;">${inspection.techComment || ''}</div>
    </div>

    <!-- Footnotes -->
    <div style="margin-bottom:10px;font-size:8.5px;line-height:1.5;">
      <div>**Indicate measurements</div>
      <div><strong>1. THIS ACKNOWLEDGES THAT THE STORE MANAGER HAS PROPERLY CONDUCTED THE SHOW &amp; TELL AND CLEARLY PRESENTED THE BASIC INSPECTION FROM FINDINGS</strong></div>
      <div>2. The above articles/vehicles are received in good condition &amp; inspection have been made to my satisfaction.</div>
      <div>3. It is customer's responsibility to disclose all concerns of the vehicle prior to availing our services.</div>
    </div>

    <!-- Signatures -->
    <table style="margin-top:100px;">
      <tr>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:4px;font-size:9px;width:40%;"><strong>${[cd.title, cd.firstName, cd.lastName].filter(Boolean).join(' ')}</strong><br>Client's Printed Name and Signature</td>
        <td style="border:none;width:5%;"></td>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:4px;font-size:9px;width:25%;"><strong>${inspection.technicianName || ''}</strong><br>Technician</td>
        <td style="border:none;width:5%;"></td>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:4px;font-size:9px;width:25%;">Store Manager</td>
      </tr>
    </table>

    </div>
    </body></html>`;
  };

  const buildExpressFormHTML = () => {
    const findings = inspection.findings || {};
    const cd = inspection.customerData || {};
    const sd = inspection.serviceData || {};

    const cb = (checked) =>
      checked
        ? `<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;text-align:center;line-height:9px;font-size:8px;vertical-align:middle;">&#10003;</span>`
        : `<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;vertical-align:middle;"></span>`;

    const T = `border:0.5px solid #bbb;padding:3px 5px;font-size:8.5px;vertical-align:middle;`;
    const Ttop = `border:0.5px solid #bbb;padding:3px 5px;font-size:8.5px;vertical-align:top;`;

    const actionBg = (action) => {
      if (action === 'Good') return 'color:#16A34A;font-weight:700;';
      if (action === 'Replace') return 'color:#DC2626;font-weight:700;';
      return 'color:#D97706;font-weight:700;';
    };
    const actionTd = (action, selected) =>
      `<td style="${T}${selected ? actionBg(action) : ''}">${action}</td>`;
    // Show ALL inspected positions with their actual condition colors
    const allPosBadges = (key) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getPos(key);
      return ['FL','FR','RL','RR'].flatMap(p => {
        const pd = pos[p];
        if (!pd) return [];
        const col = cvs[pd.color] || '#000';
        return [`<span style="color:${col};font-weight:700;margin-left:3px;">${p}</span>`];
      }).join('');
    };
    // Always show action word — from matched position data, or from INSPECTION_DATA fallback
    const alwaysActionTd = (key, condIdx) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getPos(key);
      const match = ['FL','FR','RL','RR'].find(p => pos[p]?.conditionIdx === condIdx);
      let action, col;
      if (match) {
        action = pos[match].action;
        col = cvs[pos[match].color] || '#000';
      } else {
        const [catName, itemName] = key.split('::');
        const cats = INSPECTION_DATA['express'] || [];
        const cat = cats.find(c => c.category === catName);
        const item = cat?.items.find(i => i.name === itemName);
        const cond = item?.conditions[condIdx];
        action = cond?.action || '';
        col = cond ? (cvs[cond.color] || '#666') : '#666';
      }
      return `<td style="${T};text-align:center;"><strong style="color:${col};">${action}</strong></td>`;
    };

    const getIdx = (key) => { const f = findings[key]; return f !== undefined ? f.conditionIdx : -1; };
    const getSubOpt = (key) => findings[key]?.subOption || '';
    const contaminatedTd = (key, condIdx, subOpts, label = 'Contaminated') => {
      const selected = getIdx(key) === condIdx;
      const sub = getSubOpt(key);
      const subLine = subOpts.map(o => selected && o === sub ? `<u>${o}</u>` : o).join('&nbsp;&nbsp;');
      return `<td style="${T}">${cb(selected)} ${label}${selected && subOpts.length ? `<br><span style="font-size:9px;padding-left:14px;">${subLine}</span>` : ''}</td>`;
    };
    const isSelected = (key, condIdx) => {
      const f = findings[key];
      if (!f) return false;
      if (Array.isArray(f.conditionIdxs)) return f.conditionIdxs.includes(condIdx);
      return f.conditionIdx === condIdx;
    };
    const getPos = (key) => findings[key]?.positions || {};
    const anyAtCond = (key, condIdx) =>
      ['FL','FR','RL','RR'].some(p => getPos(key)[p]?.conditionIdx === condIdx);
    // Show all 4 positions, each in their actual finding color
    const posDotsAtCond = (key) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getPos(key);
      return ['FL','FR','RL','RR'].map(p => {
        const pd = pos[p];
        const c = pd ? (cvs[pd.color] || '#000') : '#bbb';
        return `<span style="color:${c};font-weight:700;">${p}</span>`;
      }).join('&nbsp;');
    };

    const battVIdx = getIdx('BATTERY::Battery Voltage');
    const battCCAIdx = getIdx('BATTERY::Starting Power (CCA)');
    const beltDeflIdx = getIdx('BELT::Belt Deflection');
    const coolantIdx = getIdx('FLUIDS::Coolant Level');
    const brakeFluidIdx = getIdx('FLUIDS::Brake Fluid Level');
    const psIdx = getIdx('FLUIDS::Power Steering Fluid');
    const clutchIdx = getIdx('FLUIDS::Clutch Fluid');
    const airIdx = getIdx('AIR CONDITIONER::Air Cleaner');
    const lightIdx = getIdx('TEST::Light');
    const signalIdx = getIdx('TEST::Signal Light');
    const hornIdx = getIdx('TEST::Horn');
    const wiperIdx = getIdx('TEST::Wiper');
    const washerIdx = getIdx('TEST::Washer');

    const pmsAnswer = [sd.lastPmsMonth, sd.lastPmsYear].filter(Boolean).join(' ');
    const partsAnswer = (sd.replacedParts || []).join(', ');
    const problemsAnswer = (sd.currentProblems || []).join(', ');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
    <style>*{box-sizing:border-box;margin:0;padding:0;}table{border-collapse:collapse;width:100%;}</style>
    <div style="font-family:Arial,sans-serif;font-size:9px;color:#000;background:#fff;width:794px;padding:14px;">

    <!-- RAPIDE LOGO + BRANCH -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
      <div style="background:#FFD100;padding:5px 12px;border-radius:5px;display:inline-block;">
        <div style="font-family:'Arial Black',Arial,sans-serif;font-size:18px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapid&#233;</div>
        <div style="font-size:7px;font-weight:700;letter-spacing:2px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800;font-size:11px;color:#1A1A1A;">${cd.branch || 'Rapide San Antonio'}</div>
        <div style="font-size:8px;color:#6B7280;margin-top:1px;">Branch</div>
      </div>
    </div>

    <!-- TITLE -->
    <div style="color:#000;text-align:center;padding:3px 0 2px;font-family:'Arial Black',Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0;line-height:1.05;margin-bottom:5px;">EXPRESS INSPECTION FORM</div>

    <!-- VEHICLE DETAILS -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:9px;font-weight:700;letter-spacing:2px;">VEHICLE DETAILS</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:14%;"><col style="width:9%;"><col style="width:19%;"><col style="width:27%;"><col style="width:17%;"><col style="width:14%;"></colgroup>
        <tr>
          <td style="${T}"><strong>Model:</strong> ${cd.model || ''}</td>
          <td style="${T}"><strong>Year:</strong> ${cd.year || ''}</td>
          <td style="${T}"><strong>Make:</strong> ${cd.make || ''}</td>
          <td style="${T}"><strong>Plate No:</strong> ${cd.plateNo || ''}</td>
          <td style="${Ttop}" rowspan="2"><strong>KM Reading</strong><br>${cd.kmReading || ''}</td>
          <td style="${Ttop}" rowspan="2"><strong>Date:</strong><br>${inspection.date || ''}</td>
        </tr>
        <tr>
          <td style="${T}">${cb(cd.transmission === 'Manual')} Manual</td>
          <td style="${T}">${cb(cd.transmission === 'A/T')} A/T</td>
          <td style="${T}">${cb(cd.transmission === 'CVT')} CVT</td>
          <td style="${T};white-space:nowrap;">${cb(cd.fuelType === 'Gas')} Gas &nbsp; ${cb(cd.fuelType === 'Diesel')} Diesel &nbsp; ${cb(cd.fuelType === 'EV/HEV')} EV/HEV</td>
        </tr>
      </table>
    </div>

    <!-- CUSTOMER DETAILS -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:5px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:9px;font-weight:700;letter-spacing:2px;">CUSTOMER DETAILS</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:18%;"><col style="width:10%;"><col style="width:22%;"><col style="width:25%;"><col style="width:25%;"></colgroup>
        <tr>
          <td style="${T}" rowspan="2"><strong>Company:</strong> ${cd.company || ''}</td>
          <td style="${T}">${cb(cd.title === 'Mr')} Mr.</td>
          <td style="${T}"><strong>First Name:</strong> ${cd.firstName || ''}</td>
          <td style="${T}"><strong>Mobile No.</strong> ${cd.mobileNo || ''}</td>
          <td style="${T}"><strong>City:</strong> ${cd.city || ''}</td>
        </tr>
        <tr>
          <td style="${T}">${cb(cd.title === 'Ms')} Ms.</td>
          <td style="${T}"><strong>Last Name:</strong> ${cd.lastName || ''}</td>
          <td style="${T}"><strong>Email:</strong> ${cd.email || ''}</td>
          <td style="${T}"><strong>Barangay:</strong> ${cd.barangay || ''}</td>
        </tr>
        <tr>
          <td style="${T}" colspan="5"><strong>Branch:</strong> ${cd.branch || 'Rapide San Antonio'}</td>
        </tr>
      </table>
    </div>

    <!-- QUESTIONS -->
    <table style="margin-bottom:6px;">
      <tr>
        <td style="border:none;white-space:nowrap;padding:2px 0;font-size:8.5px;">1. When was your last change oil / PMS ?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:2px 0;font-size:8.5px;width:100%;">&nbsp;${pmsAnswer}</td>
      </tr>
      <tr>
        <td style="border:none;white-space:nowrap;padding:2px 0;font-size:8.5px;">2. What part/s were replaced in your last service?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:2px 0;font-size:8.5px;">&nbsp;${partsAnswer}</td>
      </tr>
      <tr>
        <td style="border:none;white-space:nowrap;padding:2px 0;font-size:8.5px;">3. Any problems with your Vehicle ATM?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:2px 0;font-size:8.5px;">&nbsp;${problemsAnswer}</td>
      </tr>
    </table>

    <!-- VEHICLE INSPECTION header -->
    <div style="background:#1A1A1A;color:#fff;text-align:center;padding:4px 0;font-size:9px;font-weight:700;letter-spacing:2px;margin-bottom:5px;border-radius:6px;">VEHICLE INSPECTION</div>

    <!-- MEASURE -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:5px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:9px;font-weight:700;letter-spacing:1px;">MEASURE</div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <!-- LEFT: BATTERY (5 content rows) -->
          <td style="width:50%;padding:0;vertical-align:top;border:none;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:26%;"><col style="width:44%;"><col style="width:30%;"></colgroup>
              <tr>
                <td style="${T};text-align:center;font-weight:700;"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${T};font-weight:900;font-size:12px;text-align:center;" rowspan="5">BATTERY</td>
                <td style="${T}">${cb(battVIdx === 0)} 12.6V – 12.8V</td>
                ${actionTd('Good', battVIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 1)} 12.2V – 12.6V</td>
                ${actionTd('Recharge', battVIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 2)} 12.2V</td>
                ${actionTd('Replace', battVIdx === 2)}
              </tr>
              <tr>
                <td style="${T}">${cb(battCCAIdx === 0)} &gt;80%</td>
                ${actionTd('Good', battCCAIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(battCCAIdx === 1)} &lt;80%</td>
                ${actionTd('Replace', battCCAIdx === 1)}
              </tr>
            </table>
          </td>
          <!-- RIGHT: BELT (6 content rows) -->
          <td style="width:50%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:20%;"><col style="width:50%;"><col style="width:30%;"></colgroup>
              <tr>
                <td style="${T};text-align:center;font-weight:700;"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${T};font-weight:900;font-size:8.5px;text-align:center;" rowspan="6">BELT</td>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 0))} Cracked</td>
                ${actionTd('Replace', isSelected('BELT::Belt Condition', 0))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 1))} Side Wall</td>
                ${actionTd('Replace', isSelected('BELT::Belt Condition', 1))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 2))} Loose</td>
                ${actionTd('Adjust', isSelected('BELT::Belt Condition', 2))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 3))} No Damage</td>
                ${actionTd('Good', isSelected('BELT::Belt Condition', 3))}
              </tr>
              <tr>
                <td style="${T}">${cb(beltDeflIdx === 0)} &lt;1/2 inch Deflection</td>
                ${actionTd('Good', beltDeflIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(beltDeflIdx === 1)} &gt;1/2 inch Deflection</td>
                ${actionTd('Adjust', beltDeflIdx === 1)}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- INSPECT -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:5px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:9px;font-weight:700;letter-spacing:1px;">INSPECT</div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <!-- LEFT INSPECT -->
          <td style="width:50%;padding:0;vertical-align:top;border:none;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:22%;"><col style="width:53%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${T};text-align:center;font-weight:700;"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <!-- COOLANT -->
              <tr>
                <td style="${T};font-weight:900;font-size:8.5px;text-align:center;" rowspan="3">Coolant</td>
                <td style="${T}">${cb(coolantIdx === 0)} Low Level</td>
                ${actionTd('Top Up', coolantIdx === 0)}
              </tr>
              <tr>
                ${contaminatedTd('FLUIDS::Coolant Level', 1, ['Oil', 'Sludge', 'Rust', 'Debris', 'Flush'])}
                ${actionTd('Flush/Replace', coolantIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(coolantIdx === 2)} Correct Level</td>
                ${actionTd('Good', coolantIdx === 2)}
              </tr>
              <!-- POWER STEERING -->
              <tr>
                <td style="${T};font-weight:900;font-size:10px;text-align:center;" rowspan="3">Power<br>Steering<br>Fluid</td>
                <td style="${T}">${cb(psIdx === 0)} Low Level</td>
                ${actionTd('Top Up', psIdx === 0)}
              </tr>
              <tr>
                ${contaminatedTd('FLUIDS::Power Steering Fluid', 1, ['Dark', 'Burnt', 'Rust', 'Debris', 'Flush'])}
                ${actionTd('Flush/Replace', psIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(psIdx === 2)} Correct Level</td>
                ${actionTd('Good', psIdx === 2)}
              </tr>
              <!-- STEERING LINKAGE -->
              <tr>
                <td style="${T};font-weight:900;font-size:10px;text-align:center;" rowspan="4">Steering<br>Linkage</td>
                <td style="${T}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 0))} Boot Damage</td>
                ${actionTd('Replace', isSelected('STEERING LINKAGE::Steering Linkage', 0))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 1))} Tie Rod Loose</td>
                ${actionTd('Replace', isSelected('STEERING LINKAGE::Steering Linkage', 1))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 2))} Steering Loose</td>
                ${actionTd('Replace', isSelected('STEERING LINKAGE::Steering Linkage', 2))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 3))} No Sign of Damage</td>
                ${actionTd('Good', isSelected('STEERING LINKAGE::Steering Linkage', 3))}
              </tr>
              <!-- TIRES: Tread Depth (3) + Bulges/Side Wall Crack (2) = 5 rows -->
              <tr>
                <td style="${Ttop};font-weight:900;font-size:8.5px;text-align:center;" rowspan="5">Tires</td>
                <td style="${T}">${cb(anyAtCond('TIRES::Tread Depth', 0))} &lt;1.7 mm ${allPosBadges('TIRES::Tread Depth')}</td>
                ${alwaysActionTd('TIRES::Tread Depth', 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(anyAtCond('TIRES::Tread Depth', 1))} 3.2 – 1.7 mm ${allPosBadges('TIRES::Tread Depth')}</td>
                ${alwaysActionTd('TIRES::Tread Depth', 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(anyAtCond('TIRES::Tread Depth', 2))} &gt;3.2 mm ${allPosBadges('TIRES::Tread Depth')}</td>
                ${alwaysActionTd('TIRES::Tread Depth', 2)}
              </tr>
              <tr>
                <td style="${T}">${cb(anyAtCond('TIRES::Bulges / Side Wall Crack', 0))} Bulges / Side Wall Crack ${allPosBadges('TIRES::Bulges / Side Wall Crack')}</td>
                ${alwaysActionTd('TIRES::Bulges / Side Wall Crack', 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(anyAtCond('TIRES::Bulges / Side Wall Crack', 1))} No Issue ${allPosBadges('TIRES::Bulges / Side Wall Crack')}</td>
                ${alwaysActionTd('TIRES::Bulges / Side Wall Crack', 1)}
              </tr>
            </table>
          </td>
          <!-- RIGHT INSPECT -->
          <td style="width:50%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:22%;"><col style="width:53%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${T};text-align:center;font-weight:700;"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <!-- BRAKE FLUID -->
              <tr>
                <td style="${T};font-weight:900;font-size:10px;text-align:center;" rowspan="3">Brake<br>Fluid</td>
                <td style="${T}">${cb(brakeFluidIdx === 0)} Low Level</td>
                ${actionTd('Top Up', brakeFluidIdx === 0)}
              </tr>
              <tr>
                ${contaminatedTd('FLUIDS::Brake Fluid Level', 1, ['Oil', 'Sludge', 'Rust', 'Debris', 'Flush'], 'Contaminated (3-4% Moisture)')}
                ${actionTd('Flush/Replace', brakeFluidIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(brakeFluidIdx === 2)} Correct Level</td>
                ${actionTd('Good', brakeFluidIdx === 2)}
              </tr>
              <!-- CLUTCH FLUID -->
              <tr>
                <td style="${T};font-weight:900;font-size:10px;text-align:center;" rowspan="3">Clutch<br>Fluid</td>
                <td style="${T}">${cb(clutchIdx === 0)} Low Level</td>
                ${actionTd('Top Up', clutchIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(clutchIdx === 1)} Contaminated (3-4% Moisture)</td>
                ${actionTd('Flush/Replace', clutchIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(clutchIdx === 2)} Correct Level</td>
                ${actionTd('Good', clutchIdx === 2)}
              </tr>
              <!-- AIR CLEANER -->
              <tr>
                <td style="${T};font-weight:900;font-size:10px;text-align:center;" rowspan="3">Air<br>Cleaner</td>
                <td style="${T}">${cb(airIdx === 2)} Clogged</td>
                ${actionTd('Replace', airIdx === 2)}
              </tr>
              <tr>
                <td style="${T}">${cb(airIdx === 1)} Light Dirt</td>
                ${actionTd('Clean', airIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(airIdx === 0)} Clean</td>
                ${actionTd('Good', airIdx === 0)}
              </tr>
              <!-- BRAKE PAD: 3 rows with positions -->
              <tr>
                <td style="${Ttop};font-weight:900;font-size:8.5px;text-align:center;" rowspan="3">Brake<br>Pad</td>
                <td style="${T}">${cb(anyAtCond('BRAKE PAD::Brake Pad', 0))} &lt;3 mm ${allPosBadges('BRAKE PAD::Brake Pad')}</td>
                ${alwaysActionTd('BRAKE PAD::Brake Pad', 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(anyAtCond('BRAKE PAD::Brake Pad', 1))} 3 – 6 mm ${allPosBadges('BRAKE PAD::Brake Pad')}</td>
                ${alwaysActionTd('BRAKE PAD::Brake Pad', 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(anyAtCond('BRAKE PAD::Brake Pad', 2))} &gt;6 mm ${allPosBadges('BRAKE PAD::Brake Pad')}</td>
                ${alwaysActionTd('BRAKE PAD::Brake Pad', 2)}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- TEST -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:5px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:9px;font-weight:700;letter-spacing:1px;">TEST</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:20%;"><col style="width:20%;"><col style="width:20%;"><col style="width:20%;"><col style="width:20%;"></colgroup>
        <tr>
          <td style="${T};text-align:center;padding-top:8px;padding-bottom:8px;"><strong>LIGHT</strong><br><br>${cb(lightIdx === 0)} All Good &nbsp; ${cb(lightIdx === 1)} Busted</td>
          <td style="${T};text-align:center;padding-top:8px;padding-bottom:8px;"><strong>SIGNAL LIGHT</strong><br><br>${cb(signalIdx === 0)} All Good &nbsp; ${cb(signalIdx === 1)} Busted</td>
          <td style="${T};text-align:center;padding-top:8px;padding-bottom:8px;"><strong>HORN</strong><br><br>${cb(hornIdx === 0)} All Good &nbsp; ${cb(hornIdx === 1)} Not Working</td>
          <td style="${T};text-align:center;padding-top:8px;padding-bottom:8px;"><strong>WIPER</strong><br><br>${cb(wiperIdx === 0)} All Good &nbsp; ${cb(wiperIdx === 1)} Busted</td>
          <td style="${T};text-align:center;padding-top:8px;padding-bottom:8px;"><strong>WASHER</strong><br><br>${cb(washerIdx === 0)} All Good &nbsp; ${cb(washerIdx === 1)} Not Working</td>
        </tr>
      </table>
    </div>

    <!-- TECHNICIAN'S COMMENT -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:5px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:9px;font-weight:700;letter-spacing:1px;">TECHNICIAN'S COMMENT</div>
      <div style="min-height:44px;padding:4px 6px;font-size:9px;">${inspection.techComment || ''}</div>
    </div>

    <!-- Footnotes -->
    <div style="margin-bottom:5px;font-size:7px;line-height:1.4;">
      <div>**Indicate measurements</div>
      <div><strong>1. THIS ACKNOWLEDGES THAT THE STORE MANAGER HAS PROPERLY CONDUCTED THE SHOW &amp; TELL AND CLEARLY PRESENTED THE BASIC INSPECTION FROM FINDINGS</strong></div>
      <div>2. The above articles/vehicles are received in good condition &amp; inspection have been made to my satisfaction.</div>
      <div>3. It is customer's responsibility to disclose all concerns of the vehicle prior to availing our services.</div>
    </div>

    <!-- Signatures -->
    <table style="margin-top:100px;">
      <tr>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:3px;font-size:8px;width:40%;"><strong>${[cd.title, cd.firstName, cd.lastName].filter(Boolean).join(' ')}</strong><br>Client's Printed Name and Signature</td>
        <td style="border:none;width:5%;"></td>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:3px;font-size:8px;width:25%;"><strong>${inspection.technicianName || ''}</strong><br>Technician</td>
        <td style="border:none;width:5%;"></td>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:3px;font-size:8px;width:25%;">Store Manager</td>
      </tr>
    </table>

    </div>
    </body></html>`;
  };

  const buildPlusFormHTML = () => {
    const findings = inspection.findings || {};
    const cd = inspection.customerData || {};
    const sd = inspection.serviceData || {};

    const cb = (checked) =>
      checked
        ? `<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;text-align:center;line-height:9px;font-size:8px;vertical-align:middle;">&#10003;</span>`
        : `<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;vertical-align:middle;"></span>`;

    const T = `border:0.5px solid #bbb;padding:2px 4px;font-size:8px;vertical-align:middle;`;
    const Ttop = `border:0.5px solid #bbb;padding:2px 4px;font-size:8px;vertical-align:top;`;
    const Tp = `border:0.5px solid #bbb;padding:1px 3px;font-size:7.5px;vertical-align:middle;`;
    const Tptop = `border:0.5px solid #bbb;padding:1px 3px;font-size:7.5px;vertical-align:top;`;

    const actionBg = (action) => {
      if (action === 'Good') return 'color:#16A34A;font-weight:700;';
      if (action === 'Replace') return 'color:#DC2626;font-weight:700;';
      return 'color:#D97706;font-weight:700;';
    };
    const actionTd = (action, selected) =>
      `<td style="${T}${selected ? actionBg(action) : ''}">${action}</td>`;
    const actionTp = (action, selected) =>
      `<td style="${Tp}${selected ? actionBg(action) : ''}">${action}</td>`;

    const getIdx = (key) => { const f = findings[key]; return f !== undefined ? f.conditionIdx : -1; };
    const getSubOpt = (key) => findings[key]?.subOption || '';
    const contaminatedTd = (key, condIdx, subOpts, label = 'Contaminated') => {
      const selected = getIdx(key) === condIdx;
      const sub = getSubOpt(key);
      const subLine = subOpts.map(o => selected && o === sub ? `<u>${o}</u>` : o).join('&nbsp;&nbsp;');
      return `<td style="${T}">${cb(selected)} ${label}${selected && subOpts.length ? `<br><span style="font-size:7px;padding-left:14px;">${subLine}</span>` : ''}</td>`;
    };
    const isSelected = (key, condIdx) => {
      const f = findings[key];
      if (!f) return false;
      if (Array.isArray(f.conditionIdxs)) return f.conditionIdxs.includes(condIdx);
      return f.conditionIdx === condIdx;
    };
    const getPos = (key) => findings[key]?.positions || {};
    const anyAtCond = (key, condIdx) =>
      ['FL','FR','RL','RR'].some(p => getPos(key)[p]?.conditionIdx === condIdx);
    // Show ALL inspected positions with their actual condition colors
    const allPosBadgesPos = (key, positions) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getPos(key);
      return positions.flatMap(p => {
        const pd = pos[p];
        if (!pd) return [];
        const col = cvs[pd.color] || '#000';
        return [`<span style="color:${col};font-weight:700;margin-left:2px;">${p}</span>`];
      }).join('');
    };
    const alwaysActionTdSmall = (key, condIdx, positions) => {
      const cvs = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' };
      const pos = getPos(key);
      const match = positions.find(p => pos[p]?.conditionIdx === condIdx);
      let action, col;
      if (match) {
        action = pos[match].action;
        col = cvs[pos[match].color] || '#000';
      } else {
        const [catName, itemName] = key.split('::');
        const cats = INSPECTION_DATA['plus'] || [];
        const cat = cats.find(c => c.category === catName);
        const item = cat?.items.find(i => i.name === itemName);
        const cond = item?.conditions[condIdx];
        action = cond?.action || '';
        col = cond ? (cvs[cond.color] || '#666') : '#666';
      }
      if (!action) return `<td style="${Tp}"></td>`;
      return `<td style="${Tp};text-align:center;"><strong style="color:${col};">${action}</strong></td>`;
    };
    const anyAtCondPos = (key, condIdx, positions) =>
      positions.some(p => getPos(key)[p]?.conditionIdx === condIdx);

    // Indices
    const battVIdx = getIdx('BATTERY::Battery Voltage');
    const battCCAIdx = getIdx('BATTERY::Starting Power (CCA)');
    const beltDeflIdx = getIdx('BELT::Belt Deflection');
    const coolantIdx = getIdx('INSPECT ENGINE BAY::Coolant Level');
    const brakeFluidIdx = getIdx('BRAKE FLUID::Brake Fluid Level');
    const psIdx = getIdx('POWER STEERING FLUID::Power Steering Fluid');
    const clutchIdx = getIdx('CLUTCH FLUID::Clutch Fluid');
    const airIdx = getIdx('AIR CONDITIONER::Air Cleaner');
    const lightIdx = getIdx('DRIVER CONTROL::Light');
    const hornIdx = getIdx('DRIVER CONTROL::Horn');
    const washerIdx = getIdx('DRIVER CONTROL::Washer');
    const brakePedalIdx = getIdx('BRAKE PEDAL::Brake Pedal Free Play');
    const transOilIdx = getIdx('TRANSMISSION::Transmission M/T, A/T, CVT Oil');
    const clutchPedalIdx = getIdx('CLUTCH PEDAL::Clutch Pedal');
    const coolingSysIdx = getIdx('INSPECT ENGINE BAY::Cooling System Hose');
    const radiatorHoseIdx = getIdx('INSPECT ENGINE BAY::Radiator Hose');

    const pmsAnswer = [sd.lastPmsMonth, sd.lastPmsYear].filter(Boolean).join(' ');
    const partsAnswer = (sd.replacedParts || []).join(', ');
    const problemsAnswer = (sd.currentProblems || []).join(', ');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
    <style>*{box-sizing:border-box;margin:0;padding:0;}table{border-collapse:collapse;width:100%;}</style>
    <div style="font-family:Arial,sans-serif;font-size:8px;color:#000;background:#fff;width:794px;padding:12px;">

    <!-- RAPIDE LOGO + BRANCH -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <div style="background:#FFD100;padding:4px 10px;border-radius:5px;display:inline-block;">
        <div style="font-family:'Arial Black',Arial,sans-serif;font-size:16px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapid&#233;</div>
        <div style="font-size:6px;font-weight:700;letter-spacing:2px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800;font-size:10px;color:#1A1A1A;">${cd.branch || 'Rapide San Antonio'}</div>
        <div style="font-size:7px;color:#6B7280;margin-top:1px;">Branch</div>
      </div>
    </div>

    <!-- TITLE -->
    <div style="color:#000;text-align:center;padding:2px 0 2px;font-family:'Arial Black',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:0;line-height:1.05;margin-bottom:4px;">PREMIUM PLUS INSPECTION FORM</div>

    <!-- VEHICLE DETAILS -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:3px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:2px;">VEHICLE DETAILS</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:14%;"><col style="width:9%;"><col style="width:19%;"><col style="width:27%;"><col style="width:17%;"><col style="width:14%;"></colgroup>
        <tr>
          <td style="${T}"><strong>Model:</strong> ${cd.model || ''}</td>
          <td style="${T}"><strong>Year:</strong> ${cd.year || ''}</td>
          <td style="${T}"><strong>Make:</strong> ${cd.make || ''}</td>
          <td style="${T}"><strong>Plate No:</strong> ${cd.plateNo || ''}</td>
          <td style="${Ttop}" rowspan="2"><strong>KM Reading</strong><br>${cd.kmReading || ''}</td>
          <td style="${Ttop}" rowspan="2"><strong>Date:</strong><br>${inspection.date || ''}</td>
        </tr>
        <tr>
          <td style="${T}">${cb(cd.transmission === 'Manual')} Manual</td>
          <td style="${T}">${cb(cd.transmission === 'A/T')} A/T</td>
          <td style="${T}">${cb(cd.transmission === 'CVT')} CVT</td>
          <td style="${T};white-space:nowrap;">${cb(cd.fuelType === 'Gas')} Gas &nbsp; ${cb(cd.fuelType === 'Diesel')} Diesel &nbsp; ${cb(cd.fuelType === 'EV/HEV')} EV/HEV</td>
        </tr>
      </table>
    </div>

    <!-- CUSTOMER DETAILS -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:3px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:2px;">CUSTOMER DETAILS</div>
      <table style="table-layout:fixed;">
        <colgroup><col style="width:18%;"><col style="width:10%;"><col style="width:22%;"><col style="width:25%;"><col style="width:25%;"></colgroup>
        <tr>
          <td style="${T}" rowspan="2"><strong>Company:</strong> ${cd.company || ''}</td>
          <td style="${T}">${cb(cd.title === 'Mr')} Mr.</td>
          <td style="${T}"><strong>First Name:</strong> ${cd.firstName || ''}</td>
          <td style="${T}"><strong>Mobile No.</strong> ${cd.mobileNo || ''}</td>
          <td style="${T}"><strong>City:</strong> ${cd.city || ''}</td>
        </tr>
        <tr>
          <td style="${T}">${cb(cd.title === 'Ms')} Ms.</td>
          <td style="${T}"><strong>Last Name:</strong> ${cd.lastName || ''}</td>
          <td style="${T}"><strong>Email:</strong> ${cd.email || ''}</td>
          <td style="${T}"><strong>Barangay:</strong> ${cd.barangay || ''}</td>
        </tr>
        <tr>
          <td style="${T}" colspan="5"><strong>Branch:</strong> ${cd.branch || 'Rapide San Antonio'}</td>
        </tr>
      </table>
    </div>

    <!-- QUESTIONS -->
    <table style="margin-bottom:4px;">
      <tr>
        <td style="border:none;white-space:nowrap;padding:1px 0;font-size:8px;">1. When was your last change oil / PMS ?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:1px 0;font-size:8px;width:100%;">&nbsp;${pmsAnswer}</td>
      </tr>
      <tr>
        <td style="border:none;white-space:nowrap;padding:1px 0;font-size:8px;">2. What part/s were replaced in your last service?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:1px 0;font-size:8px;">&nbsp;${partsAnswer}</td>
      </tr>
      <tr>
        <td style="border:none;white-space:nowrap;padding:1px 0;font-size:8px;">3. Any problems with your Vehicle ATM?&nbsp;</td>
        <td style="border:none;border-bottom:0.5px solid #bbb;padding:1px 0;font-size:8px;">&nbsp;${problemsAnswer}</td>
      </tr>
    </table>

    <!-- VEHICLE INSPECTION header -->
    <div style="background:#1A1A1A;color:#fff;text-align:center;padding:3px 0;font-size:8px;font-weight:700;letter-spacing:2px;margin-bottom:4px;border-radius:4px;">VEHICLE INSPECTION</div>

    <!-- MEASURE: Battery (left) + Belt (right) -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:1px;">MEASURE</div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <td style="width:50%;padding:0;vertical-align:top;border:none;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:26%;"><col style="width:44%;"><col style="width:30%;"></colgroup>
              <tr>
                <td style="${T};text-align:center;font-weight:700;"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${T};font-weight:900;font-size:11px;text-align:center;" rowspan="5">BATTERY</td>
                <td style="${T}">${cb(battVIdx === 0)} 12.6V – 12.8V</td>
                ${actionTd('Good', battVIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 1)} 12.2V – 12.6V</td>
                ${actionTd('Recharge', battVIdx === 1)}
              </tr>
              <tr>
                <td style="${T}">${cb(battVIdx === 2)} 12.2V</td>
                ${actionTd('Replace', battVIdx === 2)}
              </tr>
              <tr>
                <td style="${T}">${cb(battCCAIdx === 0)} &gt;80%</td>
                ${actionTd('Good', battCCAIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(battCCAIdx === 1)} &lt;80%</td>
                ${actionTd('Replace', battCCAIdx === 1)}
              </tr>
            </table>
          </td>
          <td style="width:50%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:20%;"><col style="width:50%;"><col style="width:30%;"></colgroup>
              <tr>
                <td style="${T};text-align:center;font-weight:700;"></td>
                <td style="${T};text-align:center;font-weight:700;">Condition</td>
                <td style="${T};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${T};font-weight:900;font-size:8px;text-align:center;" rowspan="6">BELT</td>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 0))} Cracked</td>
                ${actionTd('Replace', isSelected('BELT::Belt Condition', 0))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 1))} Side Wall</td>
                ${actionTd('Replace', isSelected('BELT::Belt Condition', 1))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 2))} Loose</td>
                ${actionTd('Adjust', isSelected('BELT::Belt Condition', 2))}
              </tr>
              <tr>
                <td style="${T}">${cb(isSelected('BELT::Belt Condition', 3))} No Damage</td>
                ${actionTd('Good', isSelected('BELT::Belt Condition', 3))}
              </tr>
              <tr>
                <td style="${T}">${cb(beltDeflIdx === 0)} &lt;1/2 inch Deflection</td>
                ${actionTd('Good', beltDeflIdx === 0)}
              </tr>
              <tr>
                <td style="${T}">${cb(beltDeflIdx === 1)} &gt;1/2 inch Deflection</td>
                ${actionTd('Adjust', beltDeflIdx === 1)}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- INSPECT: 3 equal columns -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:1px;">INSPECT</div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <!-- COL 1: Coolant, PS Fluid, Steering Linkage, Engine Support, Fuel/Lines, Brake Pedal -->
          <td style="width:33.33%;padding:0;vertical-align:top;border:none;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:23%;"><col style="width:52%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${Tp};text-align:center;font-weight:700;"></td>
                <td style="${Tp};text-align:center;font-weight:700;">Condition</td>
                <td style="${Tp};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7.5px;text-align:center;" rowspan="3">Coolant</td>
                <td style="${Tp}">${cb(coolantIdx === 0)} Low Level</td>
                ${actionTp('Top Up', coolantIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(coolantIdx === 1)} Contaminated</td>
                ${actionTp('Flush/Replace', coolantIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(coolantIdx === 2)} Correct Level</td>
                ${actionTp('Good', coolantIdx === 2)}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Power<br>Steering<br>Fluid</td>
                <td style="${Tp}">${cb(psIdx === 0)} Low Level</td>
                ${actionTp('Top Up', psIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(psIdx === 1)} Contaminated</td>
                ${actionTp('Flush/Replace', psIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(psIdx === 2)} Correct Level</td>
                ${actionTp('Good', psIdx === 2)}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="4">Steering<br>Linkage</td>
                <td style="${Tp}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 0))} Boot Damage</td>
                ${actionTp('Replace', isSelected('STEERING LINKAGE::Steering Linkage', 0))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 1))} Tie Rod Loose</td>
                ${actionTp('Replace', isSelected('STEERING LINKAGE::Steering Linkage', 1))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 2))} Steering Loose</td>
                ${actionTp('Replace', isSelected('STEERING LINKAGE::Steering Linkage', 2))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('STEERING LINKAGE::Steering Linkage', 3))} No Sign of Damage</td>
                ${actionTp('Good', isSelected('STEERING LINKAGE::Steering Linkage', 3))}
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Engine<br>Support</td>
                <td style="${Tp}">${cb(isSelected('ENGINE SUPPORT::Engine Support', 0))} Crack</td>
                ${actionTp('Replace', isSelected('ENGINE SUPPORT::Engine Support', 0))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('ENGINE SUPPORT::Engine Support', 1))} Sagging</td>
                ${actionTp('Replace', isSelected('ENGINE SUPPORT::Engine Support', 1))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('ENGINE SUPPORT::Engine Support', 2))} No Damage</td>
                ${actionTp('Good', isSelected('ENGINE SUPPORT::Engine Support', 2))}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Fuel Tank<br>Cap/Lines</td>
                <td style="${Tp}">${cb(isSelected('FUEL SYSTEM::Fuel Tank Cap / Lines Connection', 0))} Crack / Brittle Seal</td>
                ${actionTp('Replace', isSelected('FUEL SYSTEM::Fuel Tank Cap / Lines Connection', 0))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('FUEL SYSTEM::Fuel Tank Cap / Lines Connection', 1))} Fuel Lines Leak</td>
                ${actionTp('Replace', isSelected('FUEL SYSTEM::Fuel Tank Cap / Lines Connection', 1))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('FUEL SYSTEM::Fuel Tank Cap / Lines Connection', 2))} No Damage</td>
                ${actionTp('Good', isSelected('FUEL SYSTEM::Fuel Tank Cap / Lines Connection', 2))}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="2">Brake<br>Pedal<br>Free Play</td>
                <td style="${Tp}">${cb(brakePedalIdx === 0)} 1mm – 5mm</td>
                ${actionTp('Good', brakePedalIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(brakePedalIdx === 1)} &gt;5mm</td>
                ${actionTp('Check &amp; Adjust', brakePedalIdx === 1)}
              </tr>
            </table>
          </td>
          <!-- COL 2: Brake Fluid, Clutch Fluid, Suspension Arm, Transmission Oil, Ball Joint, Clutch Pedal -->
          <td style="width:33.33%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:23%;"><col style="width:52%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${Tp};text-align:center;font-weight:700;"></td>
                <td style="${Tp};text-align:center;font-weight:700;">Condition</td>
                <td style="${Tp};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7.5px;text-align:center;" rowspan="3">Brake<br>Fluid</td>
                <td style="${Tp}">${cb(brakeFluidIdx === 0)} Low Level</td>
                ${actionTp('Top Up', brakeFluidIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(brakeFluidIdx === 1)} Contaminated (3-4% Moisture)</td>
                ${actionTp('Flush/Replace', brakeFluidIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(brakeFluidIdx === 2)} Correct Level</td>
                ${actionTp('Good', brakeFluidIdx === 2)}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7.5px;text-align:center;" rowspan="3">Clutch<br>Fluid</td>
                <td style="${Tp}">${cb(clutchIdx === 0)} Low Level</td>
                ${actionTp('Top Up', clutchIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(clutchIdx === 1)} Contaminated (3-4% Moisture)</td>
                ${actionTp('Flush/Replace', clutchIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(clutchIdx === 2)} Correct Level</td>
                ${actionTp('Good', clutchIdx === 2)}
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Suspension<br>Arm</td>
                <td style="${Tp}">${cb(anyAtCondPos('SUSPENSION ARM::Suspension Arm', 0, ['Left','Right']))} Torn Bushing ${allPosBadgesPos('SUSPENSION ARM::Suspension Arm', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('SUSPENSION ARM::Suspension Arm', 0, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('SUSPENSION ARM::Suspension Arm', 1, ['Left','Right']))} Bent / Damage ${allPosBadgesPos('SUSPENSION ARM::Suspension Arm', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('SUSPENSION ARM::Suspension Arm', 1, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('SUSPENSION ARM::Suspension Arm', 2, ['Left','Right']))} No Damage ${allPosBadgesPos('SUSPENSION ARM::Suspension Arm', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('SUSPENSION ARM::Suspension Arm', 2, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Trans.<br>M/T,A/T<br>CVT Oil</td>
                <td style="${Tp}">${cb(transOilIdx === 0)} Contaminated</td>
                ${actionTp('Replace', transOilIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(transOilIdx === 1)} Low Level</td>
                ${actionTp('Top Up', transOilIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(transOilIdx === 2)} Correct Level</td>
                ${actionTp('Good', transOilIdx === 2)}
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Ball<br>Joint</td>
                <td style="${Tp}">${cb(anyAtCondPos('BALL JOINT::Ball Joint', 0, ['Left','Right']))} Loose ${allPosBadgesPos('BALL JOINT::Ball Joint', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('BALL JOINT::Ball Joint', 0, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('BALL JOINT::Ball Joint', 1, ['Left','Right']))} Boot Torn ${allPosBadgesPos('BALL JOINT::Ball Joint', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('BALL JOINT::Ball Joint', 1, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('BALL JOINT::Ball Joint', 2, ['Left','Right']))} No Damage ${allPosBadgesPos('BALL JOINT::Ball Joint', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('BALL JOINT::Ball Joint', 2, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="2">Clutch<br>Pedal</td>
                <td style="${Tp}">${cb(clutchPedalIdx === 0)} 10mm – 20mm</td>
                ${actionTp('Good', clutchPedalIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(clutchPedalIdx === 1)} &gt;20mm</td>
                ${actionTp('Check', clutchPedalIdx === 1)}
              </tr>
            </table>
          </td>
          <!-- COL 3: Front & Rear Susp, For Leaks, Exhaust Mounting, Cooling Hose, Radiator Hose, Air Cleaner, Drive Shaft Boot -->
          <td style="width:33.33%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:23%;"><col style="width:52%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${Tp};text-align:center;font-weight:700;"></td>
                <td style="${Tp};text-align:center;font-weight:700;">Condition</td>
                <td style="${Tp};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="5">Front<br>Susp.</td>
                <td style="${Tp}">${cb(anyAtCondPos('FRONT SUSPENSION::Front Suspension', 0, ['Left','Right']))} Excess Bounce 2-3x ${allPosBadgesPos('FRONT SUSPENSION::Front Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('FRONT SUSPENSION::Front Suspension', 0, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('FRONT SUSPENSION::Front Suspension', 1, ['Left','Right']))} Shock Absorber Oil Leak ${allPosBadgesPos('FRONT SUSPENSION::Front Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('FRONT SUSPENSION::Front Suspension', 1, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('FRONT SUSPENSION::Front Suspension', 2, ['Left','Right']))} Uneven Tire Wear ${allPosBadgesPos('FRONT SUSPENSION::Front Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('FRONT SUSPENSION::Front Suspension', 2, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('FRONT SUSPENSION::Front Suspension', 3, ['Left','Right']))} Squeaking ${allPosBadgesPos('FRONT SUSPENSION::Front Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('FRONT SUSPENSION::Front Suspension', 3, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('FRONT SUSPENSION::Front Suspension', 4, ['Left','Right']))} No Damage ${allPosBadgesPos('FRONT SUSPENSION::Front Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('FRONT SUSPENSION::Front Suspension', 4, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="5">Rear<br>Susp.</td>
                <td style="${Tp}">${cb(anyAtCondPos('REAR SUSPENSION::Rear Suspension', 0, ['Left','Right']))} Excess Bounce 2-3x ${allPosBadgesPos('REAR SUSPENSION::Rear Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('REAR SUSPENSION::Rear Suspension', 0, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('REAR SUSPENSION::Rear Suspension', 1, ['Left','Right']))} Shock Absorber Oil Leak ${allPosBadgesPos('REAR SUSPENSION::Rear Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('REAR SUSPENSION::Rear Suspension', 1, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('REAR SUSPENSION::Rear Suspension', 2, ['Left','Right']))} Uneven Tire Wear ${allPosBadgesPos('REAR SUSPENSION::Rear Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('REAR SUSPENSION::Rear Suspension', 2, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('REAR SUSPENSION::Rear Suspension', 3, ['Left','Right']))} Squeaking ${allPosBadgesPos('REAR SUSPENSION::Rear Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('REAR SUSPENSION::Rear Suspension', 3, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCondPos('REAR SUSPENSION::Rear Suspension', 4, ['Left','Right']))} No Damage ${allPosBadgesPos('REAR SUSPENSION::Rear Suspension', ['Left','Right'])}</td>
                ${alwaysActionTdSmall('REAR SUSPENSION::Rear Suspension', 4, ['Left','Right'])}
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="5">For<br>Leaks</td>
                <td style="${Tp}">${cb(isSelected('FOR LEAKS::For Leaks', 0))} Brake Line</td>
                ${actionTp('Replace', isSelected('FOR LEAKS::For Leaks', 0))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('FOR LEAKS::For Leaks', 1))} Transfer Case</td>
                ${actionTp('Replace', isSelected('FOR LEAKS::For Leaks', 1))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('FOR LEAKS::For Leaks', 2))} Transmission</td>
                ${actionTp('Replace', isSelected('FOR LEAKS::For Leaks', 2))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('FOR LEAKS::For Leaks', 3))} Differential</td>
                ${actionTp('Replace', isSelected('FOR LEAKS::For Leaks', 3))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('FOR LEAKS::For Leaks', 4))} No Leak</td>
                ${actionTp('Good', isSelected('FOR LEAKS::For Leaks', 4))}
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="2">Exhaust<br>Pipe Mnt.</td>
                <td style="${Tp}">${cb(isSelected('EXHAUST PIPE MOUNTING::Exhaust Pipe Mounting', 0))} Exhaust Hanger Damage</td>
                ${actionTp('Replace', isSelected('EXHAUST PIPE MOUNTING::Exhaust Pipe Mounting', 0))}
              </tr>
              <tr>
                <td style="${Tp}">${cb(isSelected('EXHAUST PIPE MOUNTING::Exhaust Pipe Mounting', 1))} Exhaust Gasket Leak</td>
                ${actionTp('Check', isSelected('EXHAUST PIPE MOUNTING::Exhaust Pipe Mounting', 1))}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="2">Cooling<br>Sys. Hose</td>
                <td style="${Tp}">${cb(coolingSysIdx === 0)} Cracked / Leaking</td>
                ${actionTp('Replace', coolingSysIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(coolingSysIdx === 1)} No Damage</td>
                ${actionTp('Good', coolingSysIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="2">Radiator<br>Hose</td>
                <td style="${Tp}">${cb(radiatorHoseIdx === 0)} Cracked / Swelled</td>
                ${actionTp('Replace', radiatorHoseIdx === 0)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(radiatorHoseIdx === 1)} No Damage</td>
                ${actionTp('Good', radiatorHoseIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Air<br>Cleaner</td>
                <td style="${Tp}">${cb(airIdx === 2)} Clogged</td>
                ${actionTp('Replace', airIdx === 2)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(airIdx === 1)} Light Dirt</td>
                ${actionTp('Clean', airIdx === 1)}
              </tr>
              <tr>
                <td style="${Tp}">${cb(airIdx === 0)} Clean</td>
                ${actionTp('Good', airIdx === 0)}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- TIRES + BRAKE PAD/SHOE + DRIVE SHAFT BOOT -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:1px;">TIRES &amp; BRAKES</div>
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <tr>
          <!-- LEFT: Tread Depth + Bulges/Side Wall -->
          <td style="width:40%;padding:0;vertical-align:top;border:none;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:20%;"><col style="width:55%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${Tp};text-align:center;font-weight:700;"></td>
                <td style="${Tp};text-align:center;font-weight:700;">Condition</td>
                <td style="${Tp};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7.5px;text-align:center;" rowspan="5">Tires</td>
                <td style="${Tp}">${cb(anyAtCond('TIRES::Tread Depth', 0))} &lt;1.7 mm ${allPosBadgesPos('TIRES::Tread Depth', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('TIRES::Tread Depth', 0, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('TIRES::Tread Depth', 1))} 3.2 – 1.7 mm ${allPosBadgesPos('TIRES::Tread Depth', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('TIRES::Tread Depth', 1, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('TIRES::Tread Depth', 2))} &gt;3.2 mm ${allPosBadgesPos('TIRES::Tread Depth', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('TIRES::Tread Depth', 2, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('TIRES::Bulges / Side Wall Crack', 0))} Bulges / Side Wall Crack ${allPosBadgesPos('TIRES::Bulges / Side Wall Crack', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('TIRES::Bulges / Side Wall Crack', 0, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('TIRES::Bulges / Side Wall Crack', 1))} No Issue ${allPosBadgesPos('TIRES::Bulges / Side Wall Crack', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('TIRES::Bulges / Side Wall Crack', 1, ['FL','FR','RL','RR'])}
              </tr>
            </table>
          </td>
          <!-- MIDDLE: Brake Pad/Shoe -->
          <td style="width:35%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:25%;"><col style="width:50%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${Tp};text-align:center;font-weight:700;"></td>
                <td style="${Tp};text-align:center;font-weight:700;">Condition</td>
                <td style="${Tp};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7.5px;text-align:center;" rowspan="4">Brake<br>Pad/Shoe</td>
                <td style="${Tp}">${cb(anyAtCond('BRAKE PAD / SHOE::Brake Pad / Shoe', 0))} &lt;3 mm ${allPosBadgesPos('BRAKE PAD / SHOE::Brake Pad / Shoe', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('BRAKE PAD / SHOE::Brake Pad / Shoe', 0, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('BRAKE PAD / SHOE::Brake Pad / Shoe', 1))} 3 – 6 mm ${allPosBadgesPos('BRAKE PAD / SHOE::Brake Pad / Shoe', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('BRAKE PAD / SHOE::Brake Pad / Shoe', 1, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('BRAKE PAD / SHOE::Brake Pad / Shoe', 2))} &gt;6 mm ${allPosBadgesPos('BRAKE PAD / SHOE::Brake Pad / Shoe', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('BRAKE PAD / SHOE::Brake Pad / Shoe', 2, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('BRAKE PAD / SHOE::Brake Pad / Shoe', 3))} Rotor Disc Worn ${allPosBadgesPos('BRAKE PAD / SHOE::Brake Pad / Shoe', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('BRAKE PAD / SHOE::Brake Pad / Shoe', 3, ['FL','FR','RL','RR'])}
              </tr>
            </table>
          </td>
          <!-- RIGHT: Drive Shaft Boot -->
          <td style="width:25%;padding:0;vertical-align:top;border:none;border-left:0.5px solid #bbb;">
            <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
              <colgroup><col style="width:30%;"><col style="width:45%;"><col style="width:25%;"></colgroup>
              <tr>
                <td style="${Tp};text-align:center;font-weight:700;"></td>
                <td style="${Tp};text-align:center;font-weight:700;">Condition</td>
                <td style="${Tp};text-align:center;font-weight:700;">Action</td>
              </tr>
              <tr>
                <td style="${Tptop};font-weight:900;font-size:7px;text-align:center;" rowspan="3">Drive<br>Shaft<br>Boot</td>
                <td style="${Tp}">${cb(anyAtCond('DRIVE SHAFT BOOT::Drive Shaft Boot', 0))} Broken ${allPosBadgesPos('DRIVE SHAFT BOOT::Drive Shaft Boot', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('DRIVE SHAFT BOOT::Drive Shaft Boot', 0, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('DRIVE SHAFT BOOT::Drive Shaft Boot', 1))} Leaking ${allPosBadgesPos('DRIVE SHAFT BOOT::Drive Shaft Boot', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('DRIVE SHAFT BOOT::Drive Shaft Boot', 1, ['FL','FR','RL','RR'])}
              </tr>
              <tr>
                <td style="${Tp}">${cb(anyAtCond('DRIVE SHAFT BOOT::Drive Shaft Boot', 2))} No Damage ${allPosBadgesPos('DRIVE SHAFT BOOT::Drive Shaft Boot', ['FL','FR','RL','RR'])}</td>
                ${alwaysActionTdSmall('DRIVE SHAFT BOOT::Drive Shaft Boot', 2, ['FL','FR','RL','RR'])}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- DRIVER CONTROL -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:1px;">DRIVER CONTROL</div>
      <table style="table-layout:fixed;width:100%;">
        <colgroup><col style="width:33.33%;"><col style="width:33.33%;"><col style="width:33.33%;"></colgroup>
        <tr>
          <td style="${T};text-align:center;padding-top:5px;padding-bottom:5px;"><strong>LIGHT</strong><br><br>${cb(lightIdx === 0)} All Good &nbsp; ${cb(lightIdx === 1)} Busted</td>
          <td style="${T};text-align:center;padding-top:5px;padding-bottom:5px;"><strong>HORN</strong><br><br>${cb(hornIdx === 0)} All Good &nbsp; ${cb(hornIdx === 1)} Not Working</td>
          <td style="${T};text-align:center;padding-top:5px;padding-bottom:5px;"><strong>WASHER</strong><br><br>${cb(washerIdx === 0)} All Good &nbsp; ${cb(washerIdx === 1)} Not Working</td>
        </tr>
      </table>
    </div>

    <!-- TECHNICIAN'S COMMENT -->
    <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden;margin-bottom:4px;">
      <div style="background:#1A1A1A;color:#fff;text-align:center;padding:2px 0;font-size:8px;font-weight:700;letter-spacing:1px;">TECHNICIAN'S COMMENT</div>
      <div style="min-height:32px;padding:3px 6px;font-size:8px;">${inspection.techComment || ''}</div>
    </div>

    <!-- Footnotes -->
    <div style="margin-bottom:4px;font-size:7px;line-height:1.3;">
      <div>**Indicate measurements</div>
      <div><strong>1. THIS ACKNOWLEDGES THAT THE STORE MANAGER HAS PROPERLY CONDUCTED THE SHOW &amp; TELL AND CLEARLY PRESENTED THE PREMIUM INSPECTION FROM FINDINGS</strong></div>
      <div>2. The above articles/vehicles are received in good condition &amp; inspection have been made to my satisfaction.</div>
      <div>3. It is customer's responsibility to disclose all concerns of the vehicle prior to availing our services.</div>
    </div>

    <!-- Signatures -->
    <table style="margin-top:100px;">
      <tr>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:3px;font-size:8px;width:40%;"><strong>${[cd.title, cd.firstName, cd.lastName].filter(Boolean).join(' ')}</strong><br>Client's Printed Name and Signature</td>
        <td style="border:none;width:5%;"></td>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:3px;font-size:8px;width:25%;"><strong>${inspection.technicianName || ''}</strong><br>Technician</td>
        <td style="border:none;width:5%;"></td>
        <td style="border:none;border-top:0.5px solid #bbb;text-align:center;padding-top:3px;font-size:8px;width:25%;">Store Manager</td>
      </tr>
    </table>

    </div>
    </body></html>`;
  };

  const buildPhotosPageHTML = () => {
    const findings = inspection.findings || {};
    const photos = [];
    Object.entries(findings).forEach(([key, f]) => {
      const idx = key.indexOf('::');
      const category = idx !== -1 ? key.slice(0, idx) : key;
      const name = idx !== -1 ? key.slice(idx + 2) : key;
      // Per-position photos
      if (f?.positions) {
        Object.entries(f.positions).forEach(([pos, pf]) => {
          if (pf?.photo) {
            photos.push({ category, name: `${name} (${pos})`, photo: pf.photo, color: pf.color, action: pf.action });
          }
        });
      }
      // Non-position photo
      if (f?.photo) {
        photos.push({ category, name, photo: f.photo, color: f.color, action: f.action });
      }
    });
    if (photos.length === 0) return null;

    const photoCards = photos.map((p) => {
      const textColor = p.color === 'red' ? '#DC2626' : p.color === 'yellow' ? '#D97706' : '#16A34A';
      return `
        <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;break-inside:avoid;">
          <img src="${p.photo}" style="width:100%;height:180px;object-fit:cover;display:block;" />
          <div style="padding:8px 10px;border-top:1px solid #eee;background:#fff;">
            <div style="font-size:12px;font-weight:700;color:#1A1A1A;">${p.name}</div>
            <div style="font-size:10px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:0.3px;">${p.category}</div>
            ${p.action ? `<div style="font-size:11px;font-weight:700;color:${textColor};margin-top:4px;">${p.action}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    const cd = inspection.customerData || {};
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
      <div style="font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff;width:794px;padding:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="background:#FFD100;padding:8px 16px;border-radius:8px;display:inline-block;">
            <div style="font-family:'Arial Black',Arial,sans-serif;font-size:24px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapid&#233;</div>
            <div style="font-size:8px;font-weight:700;letter-spacing:2.5px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;font-size:13px;color:#1A1A1A;">${cd.branch || 'Rapide San Antonio'}</div>
            <div style="font-size:9px;color:#6B7280;margin-top:2px;">Branch</div>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:16px;padding-bottom:10px;border-bottom:1.5px solid #1A1A1A;">
          <div style="font-size:15px;font-weight:900;letter-spacing:1.5px;color:#1A1A1A;text-transform:uppercase;">Inspection Photo Documentation</div>
          <div style="font-size:10px;color:#888;margin-top:4px;">${inspection.rif || ''} &bull; ${inspection.date || ''} &bull; ${cd.make || ''} ${cd.model || ''} ${cd.year || ''} &bull; ${cd.plateNo || ''}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
          ${photoCards}
        </div>
      </div>
    </body></html>`;
  };

  const downloadSummary = async () => {
    const html = inspection.packageType === 'express'
      ? buildExpressFormHTML()
      : inspection.packageType === 'plus'
        ? buildPlusFormHTML()
        : buildQuickFormHTML();

    const photosHTML = buildPhotosPageHTML();

    const renderCanvas = async (htmlStr) => {
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;font-family:Arial,sans-serif;color:#000;box-sizing:border-box;';
      const bodyMatch = htmlStr.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      container.innerHTML = bodyMatch ? bodyMatch[1] : '';
      container.querySelectorAll('script').forEach((s) => s.remove());
      document.body.appendChild(container);
      // Wait for all images to fully load before capturing
      const imgs = Array.from(container.querySelectorAll('img'));
      await Promise.all(imgs.map((img) =>
        img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })
      ));
      try {
        return await html2canvas(container, { scale: 3, useCORS: true, allowTaint: true, logging: false, width: 794 });
      } finally {
        document.body.removeChild(container);
      }
    };

    const addCanvasToPdf = (pdf, canvas, addNewPageFirst) => {
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6.35;
      const contentW = pageW - margin * 2;
      const imgHeightMm = (canvas.height * contentW) / canvas.width;

      let srcY = 0;
      let remaining = imgHeightMm;
      let needNewPage = addNewPageFirst;

      while (remaining > 0) {
        if (needNewPage) pdf.addPage();
        needNewPage = true;

        const sliceMm = Math.min(remaining, pageH - margin * 2);
        const slicePx = Math.round((sliceMm / imgHeightMm) * canvas.height);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = slicePx;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, contentW, sliceMm);

        srcY += slicePx;
        remaining -= sliceMm;
      }
    };

    // A4: 210mm × 297mm, 0.25 inch (6.35mm) margins
    const pdf = new jsPDF('p', 'mm', 'a4');

    const formCanvas = await renderCanvas(html);
    addCanvasToPdf(pdf, formCanvas, false);

    if (photosHTML) {
      const photosCanvas = await renderCanvas(photosHTML);
      addCanvasToPdf(pdf, photosCanvas, true); // always starts on a new page
    }

    pdf.save(`Rapide-Inspection-${inspection.rif}.pdf`);
  };

  const printInspectionForm = () => {
    const printWindow = window.open('', '_blank');
    const categories = INSPECTION_DATA[inspection.packageType] || [];
    const pkgLabel = { quick: 'QUICK', express: 'EXPRESS', plus: 'PREMIUM PLUS' };

    let checklistHTML = '';
    categories.forEach((cat) => {
      let rows = '';
      cat.items.forEach((item) => {
        if (item.hasPosition && item.positions) {
          item.positions.forEach((pos) => {
            rows += `<tr>
              <td style="padding:7px 10px;border:1px solid #ccc;font-size:12px;">${item.name} <strong>(${pos})</strong></td>
              <td style="padding:7px 10px;border:1px solid #ccc;font-size:12px;">&nbsp;</td>
              <td style="padding:7px 10px;border:1px solid #ccc;font-size:12px;">&nbsp;</td>
            </tr>`;
          });
        } else {
          rows += `<tr>
            <td style="padding:7px 10px;border:1px solid #ccc;font-size:12px;">${item.name}</td>
            <td style="padding:7px 10px;border:1px solid #ccc;font-size:12px;">&nbsp;</td>
            <td style="padding:7px 10px;border:1px solid #ccc;font-size:12px;">&nbsp;</td>
          </tr>`;
        }
      });
      checklistHTML += `
        <div style="margin-top:12px;">
          <div style="background:#1A1A1A;color:#FFD100;padding:8px 14px;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1px;border-radius:4px 4px 0 0;">${cat.category}</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:11px;font-weight:700;">ITEM</th>
              <th style="padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:11px;font-weight:700;">CONDITION</th>
              <th style="padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:11px;font-weight:700;">ACTION</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    });

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Rapide Inspection Form - ${inspection.rif}</title>
      <style>@media print { body { margin: 0; } } body { font-family: Arial, sans-serif; margin: 20px; color: #1A1A1A; }</style>
    </head><body>
      <div style="text-align:center;margin-bottom:16px;">
        <div style="background:#FFD100;padding:16px;border-radius:8px;display:inline-block;">
          <div style="font-family:'Arial Black',sans-serif;font-size:32px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapide</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:16px;"><strong style="font-size:16px;">VEHICLE INSPECTION FORM</strong></div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>RIF #:</strong> ${inspection.rif}</td>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Date:</strong> ${inspection.date}</td>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Package:</strong> ${pkgLabel[inspection.packageType]}</td>
          <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Technician:</strong> ${inspection.technicianName}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ccc;">
        <tr style="background:#f5f5f5;"><td colspan="4" style="padding:8px 10px;font-weight:800;font-size:13px;">VEHICLE INFORMATION</td></tr>
        <tr>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;"><strong>Make:</strong> ${inspection.customerData?.make || ''}</td>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;"><strong>Model:</strong> ${inspection.customerData?.model || ''}</td>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;"><strong>Year:</strong> ${inspection.customerData?.year || ''}</td>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;"><strong>Plate:</strong> ${inspection.customerData?.plateNo || ''}</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;"><strong>Trans:</strong> ${inspection.customerData?.transmission || ''}</td>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;"><strong>Fuel:</strong> ${inspection.customerData?.fuelType || ''}</td>
          <td style="padding:5px 10px;font-size:12px;border:1px solid #eee;" colspan="2"><strong>KM:</strong> ${inspection.customerData?.kmReading || ''}</td>
        </tr>
      </table>
      ${checklistHTML}
      <div style="margin-top:40px;display:flex;justify-content:space-between;">
        <div style="text-align:center;width:40%;"><div style="border-top:1px solid #1A1A1A;padding-top:4px;font-size:11px;">Customer Signature</div></div>
        <div style="text-align:center;width:40%;"><div style="border-top:1px solid #1A1A1A;padding-top:4px;font-size:11px;">Authorized by</div></div>
      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="form-screen">
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: BRAND.gray, fontSize: 14, fontWeight: 700, padding: '0 0 16px 0' }}
      >
        ← Back to Dashboard
      </button>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: BRAND.black,
              margin: 0,
            }}
          >
            Inspection Summary
          </h2>
          <p
            style={{ color: BRAND.gray, fontSize: 14, margin: 0, marginTop: 4 }}
          >
            {inspection.rif}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PrimaryButton
            onClick={printInspection}
            variant="dark"
            style={{ fontSize: 13, padding: '10px 20px', minHeight: 42 }}
          >
            Print Inspection
          </PrimaryButton>
          <PrimaryButton
            onClick={downloadSummary}
            variant="secondary"
            style={{ fontSize: 13, padding: '10px 20px', minHeight: 42 }}
          >
            Download PDF
          </PrimaryButton>
        </div>
      </div>

      {/* Header Info */}
      <div
        className="header-info-grid"
        style={{
          background: BRAND.white,
          borderRadius: 14,
          padding: 20,
          border: `2px solid ${BRAND.grayBorder}`,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          fontSize: 14,
        }}
      >
        <div>
          <span style={{ color: BRAND.gray, fontSize: 12 }}>Customer</span>
          <div style={{ fontWeight: 700 }}>{inspection.customerName}</div>
        </div>
        <div>
          <span style={{ color: BRAND.gray, fontSize: 12 }}>Vehicle</span>
          <div style={{ fontWeight: 700 }}>
            {inspection.customerData?.make} {inspection.customerData?.model}{' '}
            {inspection.customerData?.year}
          </div>
        </div>
        <div>
          <span style={{ color: BRAND.gray, fontSize: 12 }}>Plate</span>
          <div style={{ fontWeight: 700 }}>
            {inspection.customerData?.plateNo}
          </div>
        </div>
        <div>
          <span style={{ color: BRAND.gray, fontSize: 12 }}>Technician</span>
          <div style={{ fontWeight: 700 }}>{inspection.technicianName}</div>
        </div>
        <div>
          <span style={{ color: BRAND.gray, fontSize: 12 }}>Date</span>
          <div style={{ fontWeight: 700 }}>{inspection.date}</div>
        </div>
        <div>
          <span style={{ color: BRAND.gray, fontSize: 12 }}>Package</span>
          <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
            {inspection.packageType}
          </div>
        </div>
      </div>

      {/* Summary counts */}
      <div
        className="summary-counts"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: BRAND.greenBg,
            borderRadius: 12,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div className="summary-count-number" style={{ fontSize: 32, fontWeight: 900, color: BRAND.green }}>
            {greenCount}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.green }}>
            GOOD
          </div>
        </div>
        <div
          style={{
            background: BRAND.yellowStatusBg,
            borderRadius: 12,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div
            className="summary-count-number"
            style={{ fontSize: 32, fontWeight: 900, color: BRAND.yellowStatus }}
          >
            {yellowCount}
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: BRAND.yellowStatus }}
          >
            WARNING
          </div>
        </div>
        <div
          style={{
            background: BRAND.redBg,
            borderRadius: 12,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div className="summary-count-number" style={{ fontSize: 32, fontWeight: 900, color: BRAND.red }}>
            {redCount}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.red }}>
            CRITICAL
          </div>
        </div>
      </div>

      {/* Actionable items */}
      {actionable.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: BRAND.black,
              marginBottom: 12,
            }}
          >
            Service Decisions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {actionable.map((f, idx) => {
              const key = `${f.category}::${f.item}`;
              const dec = decisions[key] || {};
              return (
                <div
                  key={idx}
                  style={{
                    background: BRAND.white,
                    borderRadius: 12,
                    border: `2px solid ${colorMap[f.color]}`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: BRAND.gray,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {f.category}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: BRAND.black,
                        }}
                      >
                        {f.item}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: BRAND.gray,
                          marginTop: 2,
                        }}
                      >
                        Condition: {f.condition}
                      </div>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <span
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 12,
                          background: colorMap[f.color],
                          color: BRAND.white,
                          textTransform: 'uppercase',
                        }}
                      >
                        {f.action}
                      </span>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          onClick={() =>
                            updateDecision(key, 'proceed', !dec.proceed)
                          }
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: `2px solid ${
                              dec.proceed ? BRAND.green : BRAND.grayBorder
                            }`,
                            background: dec.proceed ? BRAND.green : BRAND.white,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: BRAND.white,
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {dec.proceed && '✓'}
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: dec.proceed ? BRAND.green : BRAND.gray,
                          }}
                        >
                          {dec.proceed ? 'Availed' : 'Proceed?'}
                        </span>
                      </label>
                    </div>
                  </div>
                  {!dec.proceed && (
                    <div
                      style={{
                        padding: '10px 16px',
                        borderTop: `1px solid ${BRAND.grayBorder}`,
                        background: BRAND.grayLight,
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: BRAND.gray,
                        }}
                      >
                        Decline Reason{f.color === 'red' ? ' *' : ''}:
                      </span>
                      <select
                        value={dec.reason || ''}
                        onChange={(e) =>
                          updateDecision(key, 'reason', e.target.value)
                        }
                        style={{
                          minHeight: 38,
                          padding: '4px 10px',
                          border: `1px solid ${BRAND.grayBorder}`,
                          borderRadius: 8,
                          fontSize: 13,
                          background: BRAND.white,
                        }}
                      >
                        <option value="">Select reason...</option>
                        {DECLINE_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {dec.reason === 'Other' && (
                        <input
                          placeholder="Specify..."
                          value={dec.note || ''}
                          onChange={(e) =>
                            updateDecision(key, 'note', e.target.value)
                          }
                          style={{
                            flex: 1,
                            minWidth: 150,
                            minHeight: 38,
                            padding: '4px 10px',
                            border: `1px solid ${BRAND.grayBorder}`,
                            borderRadius: 8,
                            fontSize: 13,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tech Comment */}
      {inspection.techComment && (
        <div
          style={{
            background: BRAND.yellowPale,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: BRAND.gray,
              marginBottom: 4,
            }}
          >
            Technician Comment
          </div>
          <div style={{ fontSize: 14, color: BRAND.black }}>
            {inspection.techComment}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 8,
          paddingBottom: 20,
        }}
      >
        <PrimaryButton onClick={onBack} variant="secondary">
          ← Back
        </PrimaryButton>
        <PrimaryButton onClick={handleSave}>Save Decisions</PrimaryButton>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY
// ============================================================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#E31E24' }}>Something went wrong</h2>
          <pre style={{ background: '#f3f4f6', padding: 16, borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {this.state.error.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// MAIN APP
// ============================================================
function AppInner() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [packageType, setPackageType] = useState(null);
  const [customerData, setCustomerData] = useState({
    date: new Date().toLocaleDateString('en-PH'),
  });
  const [serviceData, setServiceData] = useState({});
  const [findings, setFindings] = useState({});
  const [currentCatIdx, setCurrentCatIdx] = useState(0);
  const [techComment, setTechComment] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [inspections, setInspections] = useState([]);
  const [viewingInspection, setViewingInspection] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [brands, setBrands] = useState([...CAR_BRANDS]);
  const [models, setModels] = useState({ ...CAR_MODELS });
  const [municipalities, setMunicipalities] = useState([...MUNICIPALITY_LIST]);
  const [barangays, setBarangays] = useState({ ..._barangaysByMunicipality });
  const [technicians, setTechnicians] = useState([]);
  const [fleets, setFleets] = useState([...fleetData.fleet_customers].sort());
  const [branches, setBranches] = useState([{ id: 1, name: 'Rapide San Antonio' }]);

  const fillDemoData = () => {
    setCustomerData({
      date: new Date().toLocaleDateString('en-PH'),
      model: 'Civic', year: '2020', make: 'Honda',
      plateNo: 'ABC 1234', kmReading: '45,000',
      transmission: 'A/T', fuelType: 'Gas',
      title: 'Mr', firstName: 'Juan', lastName: 'dela Cruz',
      mobileNo: '09171234567', city: 'Makati', barangay: 'Bel-Air', company: '',
    });
    setServiceData({
      lastPmsMonth: 'January', lastPmsYear: '2025',
      replacedParts: ['Oil Filter', 'Air Filter'],
      currentProblems: ['Noise when braking'],
    });
    setTechComment('Vehicle in generally good condition. Recommend tire rotation on next visit.');
    const f = {};
    if (packageType === 'express') {
      f['BATTERY::Battery Voltage'] = { conditionIdx: 0, condition: '12.6V – 12.8V', action: 'Good', color: 'green' };
      f['BATTERY::Starting Power (CCA)'] = { conditionIdx: 0, condition: '>80%', action: 'Good', color: 'green' };
      f['BELT::Belt Condition'] = { conditionIdxs: [3] };
      f['BELT::Belt Deflection'] = { conditionIdx: 0, condition: '<1/2 inch Deflection', action: 'Good', color: 'green' };
      f['FLUIDS::Coolant Level'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['FLUIDS::Brake Fluid Level'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['FLUIDS::Power Steering Fluid'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['FLUIDS::Clutch Fluid'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['STEERING LINKAGE::Steering Linkage'] = { conditionIdxs: [3] };
      f['TIRES::Tread Depth'] = { positions: {
        FL: { conditionIdx: 2, condition: '>3.2 mm', action: 'Good', color: 'green' },
        FR: { conditionIdx: 2, condition: '>3.2 mm', action: 'Good', color: 'green' },
        RL: { conditionIdx: 0, condition: '<1.7 mm', action: 'Replace', color: 'red' },
        RR: { conditionIdx: 1, condition: '3.2 – 1.7 mm', action: 'Observe', color: 'yellow' },
      }};
      f['TIRES::Bulges / Side Wall Crack'] = { positions: {
        FL: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
        FR: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
        RL: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
        RR: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
      }};
      f['AIR CONDITIONER::Air Cleaner'] = { conditionIdx: 0, condition: 'Clean', action: 'Good', color: 'green' };
      f['BRAKE PAD::Brake Pad'] = { positions: {
        FL: { conditionIdx: 0, condition: '<3 mm', action: 'Replace', color: 'red' },
        FR: { conditionIdx: 2, condition: '>6 mm', action: 'Good', color: 'green' },
        RL: { conditionIdx: 1, condition: '3 – 6 mm', action: 'Observe', color: 'yellow' },
        RR: { conditionIdx: 2, condition: '>6 mm', action: 'Good', color: 'green' },
      }};
      f['TEST::Light'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['TEST::Signal Light'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['TEST::Horn'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['TEST::Wiper'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['TEST::Washer'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
    } else if (packageType === 'plus') {
      f['BATTERY::Battery Voltage'] = { conditionIdx: 0, condition: '12.6V – 12.8V', action: 'Good', color: 'green' };
      f['BATTERY::Starting Power (CCA)'] = { conditionIdx: 0, condition: '>80%', action: 'Good', color: 'green' };
      f['BELT::Belt Condition'] = { conditionIdxs: [3] };
      f['BELT::Belt Deflection'] = { conditionIdx: 0, condition: '<1/2 inch Deflection', action: 'Good', color: 'green' };
      f['INSPECT ENGINE BAY::Coolant Level'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['BRAKE FLUID::Brake Fluid Level'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['POWER STEERING FLUID::Power Steering Fluid'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['CLUTCH FLUID::Clutch Fluid'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['STEERING LINKAGE::Steering Linkage'] = { conditionIdxs: [3] };
      f['TIRES::Tread Depth'] = { positions: {
        FL: { conditionIdx: 2, condition: '>3.2 mm', action: 'Good', color: 'green' },
        FR: { conditionIdx: 2, condition: '>3.2 mm', action: 'Good', color: 'green' },
        RL: { conditionIdx: 0, condition: '<1.7 mm', action: 'Replace', color: 'red' },
        RR: { conditionIdx: 1, condition: '3.2 – 1.7 mm', action: 'Observe', color: 'yellow' },
      }};
      f['TIRES::Bulges / Side Wall Crack'] = { positions: {
        FL: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
        FR: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
        RL: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
        RR: { conditionIdx: 1, condition: 'No Issue', action: 'Good', color: 'green' },
      }};
      f['AIR CONDITIONER::Air Cleaner'] = { conditionIdx: 0, condition: 'Clean', action: 'Good', color: 'green' };
      f['BRAKE PAD / SHOE::Brake Pad / Shoe'] = { positions: {
        FL: { conditionIdx: 0, condition: '<3 mm', action: 'Replace', color: 'red' },
        FR: { conditionIdx: 2, condition: '>6 mm', action: 'Good', color: 'green' },
        RL: { conditionIdx: 1, condition: '3 – 6 mm', action: 'Observe', color: 'yellow' },
        RR: { conditionIdx: 2, condition: '>6 mm', action: 'Good', color: 'green' },
      }};
      f['DRIVER CONTROL::Light'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['DRIVER CONTROL::Horn'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['DRIVER CONTROL::Washer'] = { conditionIdx: 0, condition: 'All Good', action: 'Good', color: 'green' };
      f['ENGINE SUPPORT::Engine Support'] = { conditionIdxs: [2] };
      f['FUEL SYSTEM::Fuel Tank Cap / Lines Connection'] = { conditionIdxs: [2] };
      f['BRAKE PEDAL::Brake Pedal Free Play'] = { conditionIdx: 0, condition: '1mm – 5mm', action: 'Good', color: 'green' };
      f['SUSPENSION ARM::Suspension Arm'] = { positions: {
        Left: { conditionIdx: 0, condition: 'Torn Bushing', action: 'Replace', color: 'red' },
        Right: { conditionIdx: 2, condition: 'No Damage', action: 'Good', color: 'green' },
      }};
      f['TRANSMISSION::Transmission M/T, A/T, CVT Oil'] = { conditionIdx: 2, condition: 'Correct Level', action: 'Good', color: 'green' };
      f['BALL JOINT::Ball Joint'] = { positions: {
        Left: { conditionIdx: 2, condition: 'No Damage', action: 'Good', color: 'green' },
        Right: { conditionIdx: 2, condition: 'No Damage', action: 'Good', color: 'green' },
      }};
      f['CLUTCH PEDAL::Clutch Pedal'] = { conditionIdx: 0, condition: '10mm – 20mm', action: 'Good', color: 'green' };
      f['FRONT SUSPENSION::Front Suspension'] = { positions: {
        Left: { conditionIdx: 4, condition: 'No Damage', action: 'Good', color: 'green' },
        Right: { conditionIdx: 4, condition: 'No Damage', action: 'Good', color: 'green' },
      }};
      f['REAR SUSPENSION::Rear Suspension'] = { positions: {
        Left: { conditionIdx: 0, condition: 'Excess Bounce 2-3x', action: 'Replace', color: 'red' },
        Right: { conditionIdx: 4, condition: 'No Damage', action: 'Good', color: 'green' },
      }};
      f['FOR LEAKS::For Leaks'] = { conditionIdxs: [4] };
      f['EXHAUST PIPE MOUNTING::Exhaust Pipe Mounting'] = { conditionIdxs: [] };
      f['INSPECT ENGINE BAY::Cooling System Hose'] = { conditionIdx: 1, condition: 'No Damage', action: 'Good', color: 'green' };
      f['INSPECT ENGINE BAY::Radiator Hose'] = { conditionIdx: 0, condition: 'Cracked / Swelled', action: 'Replace', color: 'red' };
      f['DRIVE SHAFT BOOT::Drive Shaft Boot'] = { positions: {
        FL: { conditionIdx: 2, condition: 'No Damage', action: 'Good', color: 'green' },
        FR: { conditionIdx: 0, condition: 'Broken', action: 'Replace', color: 'red' },
        RL: { conditionIdx: 2, condition: 'No Damage', action: 'Good', color: 'green' },
        RR: { conditionIdx: 2, condition: 'No Damage', action: 'Good', color: 'green' },
      }};
    }
    setFindings(f);
  };

  // Draft tracking — use a ref so RIF is stable across re-renders
  const draftRifRef = useRef(null);

  const getOrCreateDraftRif = () => {
    if (!draftRifRef.current) draftRifRef.current = generateRIF();
    return draftRifRef.current;
  };

  const saveCurrentDraft = (savedScreen, savedCatIdx) => {
    const rif = getOrCreateDraftRif();
    const status = (savedScreen === 'inspection' || savedScreen === 'techComment') ? 'in_progress' : 'draft';
    const draft = {
      rif,
      packageType,
      date: new Date().toLocaleDateString('en-PH'),
      customerName: `${customerData.title || ''} ${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
      technicianName: serviceData.technicianName || '',
      customerData: { ...customerData },
      serviceData: { ...serviceData },
      findings: { ...findings },
      techComment,
      status,
      savedScreen,
      savedCatIdx: savedCatIdx !== undefined ? savedCatIdx : currentCatIdx,
    };
    setInspections((prev) => {
      const idx = prev.findIndex((i) => i.rif === rif);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = draft;
        return updated;
      }
      return [draft, ...prev];
    });
  };

  const handleResume = (ins) => {
    draftRifRef.current = ins.rif;
    setPackageType(ins.packageType);
    setCustomerData({ ...ins.customerData });
    setServiceData({ ...ins.serviceData });
    setFindings({ ...ins.findings });
    setTechComment(ins.techComment || '');
    setCurrentCatIdx(ins.savedCatIdx || 0);
    setViewingInspection(null);
    setScreen(ins.savedScreen || 'customerVehicle');
  };

  const handleLogin = (u) => {
    setUser(u);
    draftRifRef.current = null;
    setPackageType(null);
    setCustomerData({ date: new Date().toLocaleDateString('en-PH'), branch: branches[0]?.name || 'Rapide San Antonio' });
    setServiceData({});
    setFindings({});
    setCurrentCatIdx(0);
    setTechComment('');
    setScreen('dashboard');
  };
  const handleLogout = () => {
    setUser(null);
    setScreen('login');
  };

  // Start a brand-new inspection (clears all state)
  const handleNewInspection = () => {
    draftRifRef.current = null;
    setPackageType(null);
    setCustomerData({ date: new Date().toLocaleDateString('en-PH'), branch: branches[0]?.name || 'Rapide San Antonio' });
    setServiceData({});
    setFindings({});
    setCurrentCatIdx(0);
    setTechComment('');
    setScreen('customerVehicle');
  };

  // Called after CustomerVehicle is saved — go directly to service questions
  const handleCustomerVehicleSave = () => {
    setScreen('serviceQuestions');
  };

  // Called after ServiceQuestions are saved — go directly to package selection
  const handleServiceQuestionsSave = () => {
    setScreen('packageSelect');
  };

  // Called when package is selected — save to dashboard and show success
  const handlePackageSelect = (pkg) => {
    setPackageType(pkg);
    setCurrentCatIdx(0);
    const rif = getOrCreateDraftRif();
    const newRecord = {
      rif,
      packageType: pkg,
      date: new Date().toLocaleDateString('en-PH'),
      customerName: `${customerData.title || ''} ${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
      technicianName: serviceData.technicianName || '',
      customerData: { ...customerData },
      serviceData: { ...serviceData },
      findings: {},
      techComment: '',
      status: 'in_progress',
      savedScreen: 'inspection',
      savedCatIdx: 0,
    };
    setInspections((prev) => {
      const idx = prev.findIndex((i) => i.rif === rif);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = newRecord;
        return updated;
      }
      return [newRecord, ...prev];
    });
    setScreen('dashboard');
    setSuccessToast('__package_selected__');
  };

  const handleSubmitInspection = () => {
    const rif = getOrCreateDraftRif();
    const newInspection = {
      rif,
      packageType,
      date: new Date().toLocaleDateString('en-PH'),
      customerName: `${customerData.title || ''} ${
        customerData.firstName || ''
      } ${customerData.lastName || ''}`.trim(),
      technicianName: serviceData.technicianName || '',
      customerData: { ...customerData },
      serviceData: { ...serviceData },
      findings: { ...findings },
      techComment,
      status: 'finished',
    };
    setInspections((prev) => {
      const idx = prev.findIndex((i) => i.rif === rif);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = newInspection;
        return updated;
      }
      return [newInspection, ...prev];
    });
    draftRifRef.current = null;
    setShowSubmitModal(false);
    setScreen('dashboard');
    setSuccessToast(rif);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const categories = INSPECTION_DATA[packageType] || [];

  const handleAddTechnician = (name) => {
    setTechnicians((prev) => [...prev, { id: Date.now(), name, active: true }]);
  };
  const handleEditTechnician = (id, newName) => {
    setTechnicians((prev) => prev.map((t) => t.id === id ? { ...t, name: newName } : t));
  };
  const handleAddBrand = (name) => {
    if (!brands.includes(name)) setBrands((prev) => [...prev, name].sort());
  };
  const handleAddModel = (brand, modelName) => {
    setModels((prev) => ({
      ...prev,
      [brand]: [...(prev[brand] || []), modelName],
    }));
  };
  const handleAddMunicipality = (name) => {
    if (!municipalities.includes(name)) {
      setMunicipalities((prev) => {
        const filtered = prev.filter(m => m !== 'Others');
        return [...filtered.concat(name).sort(), 'Others'];
      });
      setBarangays((prev) => ({ ...prev, [name]: [] }));
    }
  };
  const handleAddFleet = (name) => {
    if (name.trim()) setFleets((prev) => [...new Set([...prev, name.trim()])].sort());
  };
  const handleAddBranch = (name) => {
    if (name.trim()) setBranches((prev) => [...prev, { id: Date.now(), name: name.trim() }]);
  };
  const handleEditBranch = (id, newName) => {
    setBranches((prev) => prev.map((b) => b.id === id ? { ...b, name: newName } : b));
  };
  const handleAddBarangay = (municipality, barangayName) => {
    setBarangays((prev) => ({
      ...prev,
      [municipality]: [...(prev[municipality] || []), barangayName].sort(),
    }));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BRAND.grayLight,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {successToast && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSuccessToast(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 20, padding: '40px 36px',
              maxWidth: 380, width: '100%', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#DCFCE7', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="12" fill="#16A34A"/>
                <path d="M7 12.5L10.5 16L17 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {successToast === '__package_selected__' ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.black, marginBottom: 8 }}>
                  Inspection Ready!
                </div>
                <div style={{ fontSize: 14, color: BRAND.gray, marginBottom: 28 }}>
                  The inspection has been saved to the dashboard. Resume it to start filling in the inspection findings.
                </div>
              </>
            ) : successToast === '__customer_saved__' ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.black, marginBottom: 8 }}>
                  Customer Saved!
                </div>
                <div style={{ fontSize: 14, color: BRAND.gray, marginBottom: 28 }}>
                  The inspection has been added to the dashboard. Resume it to fill in service questions.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.black, marginBottom: 8 }}>
                  Inspection Complete!
                </div>
                <div style={{ fontSize: 14, color: BRAND.gray, marginBottom: 6 }}>
                  The inspection has been saved to the dashboard.
                </div>
                <div style={{
                  display: 'inline-block', background: BRAND.grayLight,
                  borderRadius: 8, padding: '6px 16px', fontSize: 13,
                  fontWeight: 700, color: BRAND.black, marginBottom: 28,
                  fontFamily: 'monospace',
                }}>
                  RIF: {successToast}
                </div>
              </>
            )}
            <button
              onClick={() => setSuccessToast(null)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                background: '#16A34A', color: '#fff', border: 'none',
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {screen === 'login' && <LoginScreen onLogin={handleLogin} />}

      {screen !== 'login' && user && (
        <TopBar
          user={user}
          onLogout={handleLogout}
          packageType={['customerVehicle', 'serviceQuestions', 'inspection', 'techComment'].includes(screen) ? packageType : null}
          onDashboard={() => {
            if (!['login', 'dashboard', 'manage', 'report'].includes(screen)) {
              saveCurrentDraft(screen);
            }
            setViewingInspection(null);
            setScreen('dashboard');
          }}
          onManage={() => setScreen('manage')}
          onReport={() => setScreen('report')}
        />
      )}

      {screen === 'packageSelect' && (
        <PackageSelectionScreen onSelect={handlePackageSelect} />
      )}

      {screen === 'customerVehicle' && (
        <CustomerVehicleScreen
          data={customerData}
          setData={setCustomerData}
          onSave={handleCustomerVehicleSave}
          brands={brands}
          models={models}
          municipalities={municipalities}
          barangays={barangays}
          fleets={fleets}
          branches={branches}
        />
      )}

      {screen === 'serviceQuestions' && (
        <ServiceQuestionsScreen
          data={serviceData}
          setData={setServiceData}
          onSave={handleServiceQuestionsSave}
          technicians={technicians}
        />
      )}

      {screen === 'inspection' && (
        <InspectionScreen
          categories={categories}
          findings={findings}
          setFindings={setFindings}
          currentCategoryIdx={currentCatIdx}
          setCurrentCategoryIdx={setCurrentCatIdx}
          onFinish={() => { saveCurrentDraft('techComment'); setScreen('techComment'); }}
          onBack={() => { saveCurrentDraft('serviceQuestions'); setScreen('serviceQuestions'); }}
          onFillDemo={fillDemoData}
        />
      )}

      {screen === 'techComment' && (
        <TechCommentScreen
          comment={techComment}
          setComment={setTechComment}
          onFinish={() => setShowSubmitModal(true)}
          onBack={() => {
            const lastIdx = categories.length - 1;
            setCurrentCatIdx(lastIdx);
            saveCurrentDraft('inspection', lastIdx);
            setScreen('inspection');
          }}
        />
      )}

      {showSubmitModal && (
        <SubmitModal
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={handleSubmitInspection}
        />
      )}

      {screen === 'manage' && (
        <ManageScreen
          technicians={technicians}
          brands={brands}
          models={models}
          municipalities={municipalities}
          barangays={barangays}
          fleets={fleets}
          branches={branches}
          onAddTechnician={handleAddTechnician}
          onEditTechnician={handleEditTechnician}
          onAddBrand={handleAddBrand}
          onAddModel={handleAddModel}
          onAddMunicipality={handleAddMunicipality}
          onAddBarangay={handleAddBarangay}
          onAddFleet={handleAddFleet}
          onAddBranch={handleAddBranch}
          onEditBranch={handleEditBranch}
        />
      )}

      {screen === 'report' && (
        <ReportScreen
          inspections={inspections}
          technicians={technicians}
          onBack={() => setScreen('dashboard')}
        />
      )}

      {screen === 'dashboard' && !viewingInspection && (
        <AdminDashboard
          inspections={inspections}
          onView={(ins) => setViewingInspection(ins)}
          onResume={handleResume}
          onNewInspection={handleNewInspection}
          onDelete={(rif) => setInspections((prev) => prev.filter((ins) => ins.rif !== rif))}
          technicians={technicians}
        />
      )}

      {screen === 'dashboard' && viewingInspection && (
        <ServiceDecisionScreen
          inspection={viewingInspection}
          onSave={(decisions) => {
            const updated = {
              ...viewingInspection,
              decisions,
              status: 'reviewed',
            };
            setInspections((prev) =>
              prev.map((ins) => (ins.rif === updated.rif ? updated : ins))
            );
            setViewingInspection(null);
          }}
          onBack={() => setViewingInspection(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
