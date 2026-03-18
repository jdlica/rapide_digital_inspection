import React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import makeModelData from './data/make_model.json';

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

// --- MASTER DATA (derived from make_model.json) ---
const _modelsMap = {};
for (const entry of makeModelData) {
  if (!entry.make || entry.deleted_at != null) continue;
  if (!_modelsMap[entry.make]) _modelsMap[entry.make] = new Set();
  if (entry.model) _modelsMap[entry.make].add(entry.model);
}
const CAR_BRANDS = Object.keys(_modelsMap).sort();
const CAR_MODELS = Object.fromEntries(
  Object.entries(_modelsMap).map(([make, set]) => [make, [...set].sort()])
);

const REPLACED_PARTS = [
  'DRIVE BELT',
  'TIE ROD',
  'RACK END',
  'SHOCK ABSORBER',
  'VALVE COVER GASKET',
  'LOWER ARM ASSY',
  'STABILIZER LINK',
  'WIPER BLADE',
  'AIR FILTER',
  'RADIATOR ASSY',
  'BRAKE PAD',
  'FAN BELT',
  'COMPRESSOR',
  'WHEEL CYLINDER',
  'FUEL FILTER',
  'IGNITION COIL',
  'OIL FILTER',
  'OIL SEAL',
  'RELEASE BEARING',
  'ENGINE SUPPORT',
  'CABIN FILTER',
  'AXLE GREASE',
  'BRAKE SHOE',
  'CLUTCH DISC',
  'RADIATOR CAP',
  'ALTERNATOR ASSY',
  'TIMING BELT',
  'CALIPER KIT',
  'WATER PUMP',
  'SPARK PLUG',
  'LOWER BALL JOINT',
  'THERMOSTAT VALVE',
  'STARTER ASSY',
  'ROTOR DISC',
  'STEERING BOOT',
  'EXPANSION VALVE',
  'AUTO TENSIONER',
  'FRONT SHOCK MOUNTING',
  'STABILIZER BAR BUSHING',
  'POWER STEERING BELT',
  'TRANSMISSION FILTER',
  'FRONT WHEEL BEARING',
  'REAR WHEEL BEARING',
].sort();

const PH_CITIES = {
  Manila: [
    'Barangay 1',
    'Barangay 2',
    'Barangay 3',
    'Barangay 100',
    'Barangay 200',
    'Barangay 300',
    'Barangay 400',
    'Barangay 500',
    'Ermita',
    'Intramuros',
    'Malate',
    'Paco',
    'Pandacan',
    'Quiapo',
    'Sampaloc',
    'San Miguel',
    'San Nicolas',
    'Santa Ana',
    'Santa Cruz',
    'Tondo',
  ],
  'Quezon City': [
    'Bagong Pag-asa',
    'Bahay Toro',
    'Balara',
    'Batasan Hills',
    'Commonwealth',
    'Cubao',
    'Diliman',
    'East Kamias',
    'Fairview',
    'Holy Spirit',
    'Kalusugan',
    'Kamuning',
    'Loyola Heights',
    'New Era',
    'Novaliches',
    'Project 6',
    'San Francisco del Monte',
    'Sikatuna Village',
    'South Triangle',
    'Teachers Village',
    'UP Campus',
    'Vasra',
  ],
  Makati: [
    'Bangkal',
    'Bel-Air',
    'Carmona',
    'Cembo',
    'Comembo',
    'Dasmariñas',
    'Forbes Park',
    'Guadalupe Nuevo',
    'Guadalupe Viejo',
    'La Paz',
    'Legazpi Village',
    'Magallanes',
    'Olympia',
    'Palanan',
    'Pembo',
    'Pinagkaisahan',
    'Poblacion',
    'Post Proper',
    'Rembo',
    'Rizal',
    'Salcedo Village',
    'San Antonio',
    'San Isidro',
    'San Lorenzo',
    'Santa Cruz',
    'Singkamas',
    'South Cembo',
    'Tejeros',
    'Urdaneta',
    'Valenzuela',
    'West Rembo',
  ],
  Pasig: [
    'Bagong Ilog',
    'Bambang',
    'Buting',
    'Caniogan',
    'Dela Paz',
    'Kalawaan',
    'Kapitolyo',
    'Malinao',
    'Manggahan',
    'Maybunga',
    'Oranbo',
    'Palatiw',
    'Pinagbuhatan',
    'Rosario',
    'Sagad',
    'San Antonio',
    'San Joaquin',
    'San Jose',
    'San Miguel',
    'Santa Lucia',
    'Santa Rosa',
    'Santo Tomas',
    'Ugong',
  ],
  Taguig: [
    'Bagumbayan',
    'Bambang',
    'Calzada',
    'Central Bicutan',
    'Central Signal Village',
    'Fort Bonifacio',
    'Hagonoy',
    'Ibayo-Tipas',
    'Katuparan',
    'Ligid-Tipas',
    'Lower Bicutan',
    'Maharlika Village',
    'Napindan',
    'New Lower Bicutan',
    'North Daang Hari',
    'North Signal Village',
    'Palingon',
    'Pinagsama',
    'San Martin de Porres',
    'Santa Ana',
    'South Daang Hari',
    'South Signal Village',
    'Upper Bicutan',
    'Ususan',
    'Wawa',
    'Western Bicutan',
  ],
  Parañaque: [
    'Baclaran',
    'BF Homes',
    'Don Bosco',
    'Don Galo',
    'La Huerta',
    'Marcelo Green',
    'Merville',
    'Moonwalk',
    'San Antonio',
    'San Dionisio',
    'San Isidro',
    'San Martin de Porres',
    'Santo Niño',
    'Sun Valley',
    'Sucat',
    'Tambo',
    'Vitalez',
  ],
  Pasay: [
    'Barangay 1',
    'Barangay 2',
    'Barangay 10',
    'Barangay 48',
    'Barangay 76',
    'Barangay 100',
    'Barangay 183',
    'Barangay 184',
    'Malibay',
    'San Isidro',
    'San Jose',
    'Santa Clara',
    'Santo Niño',
    'Villamor',
  ],
  Caloocan: [
    'Bagong Barrio',
    'Bagong Silang',
    'Camarin',
    'Dagat-dagatan',
    'Deparo',
    'Grace Park',
    'Llano',
    'Maypajo',
    'Morning Breeze',
    'Sangandaan',
    'Tala',
    'Zabarte',
  ],
  'Las Piñas': [
    'Almanza Uno',
    'Almanza Dos',
    'BF International',
    'CAA',
    'Daniel Fajardo',
    'Elias Aldana',
    'Ilaya',
    'Manuyo Uno',
    'Manuyo Dos',
    'Pamplona Uno',
    'Pamplona Dos',
    'Pamplona Tres',
    'Pilar',
    'Pulang Lupa Uno',
    'Pulang Lupa Dos',
    'Talon Uno',
    'Talon Dos',
    'Talon Tres',
    'Talon Singko',
    'Zapote',
  ],
  Marikina: [
    'Barangka',
    'Calumpang',
    'Concepcion Uno',
    'Concepcion Dos',
    'Fortune',
    'Industrial Valley',
    'Jesus dela Peña',
    'Malanday',
    'Nangka',
    'Parang',
    'San Roque',
    'Santa Elena',
    'Santo Niño',
    'Tañong',
    'Tumana',
  ],
  Muntinlupa: [
    'Alabang',
    'Bayanan',
    'Buli',
    'Cupang',
    'New Alabang Village',
    'Poblacion',
    'Putatan',
    'Sucat',
    'Tunasan',
  ],
  Valenzuela: [
    'Arkong Bato',
    'Balangkas',
    'Bignay',
    'Bisig',
    'Canumay East',
    'Canumay West',
    'Coloong',
    'Dalandanan',
    'Isla',
    'Karuhatan',
    'Lawang Bato',
    'Lingunan',
    'Mabolo',
    'Malanday',
    'Malinta',
    'Mapulang Lupa',
    'Marulas',
    'Maysan',
    'Palasan',
    'Parada',
    'Pariancillo Villa',
    'Paso de Blas',
    'Pasolo',
    'Poblacion',
    'Polo',
    'Rincon',
    'Tagalag',
    'Ugong',
    'Veinte Reales',
    'Wawang Pulo',
  ],
  'San Juan': [
    'Addition Hills',
    'Balong-Bato',
    'Batis',
    'Corazon de Jesus',
    'Ermitaño',
    'Greenhills',
    'Isabelita',
    'Kabayanan',
    'Little Baguio',
    'Maytunas',
    'Onse',
    'Pasadeña',
    'Pedro Cruz',
    'Progreso',
    'Rivera',
    'Salapan',
    'San Perfecto',
    'Santa Lucia',
    'Tibagan',
    'West Crame',
  ],
  Mandaluyong: [
    'Addition Hills',
    'Bagong Silang',
    'Barangka Drive',
    'Barangka Ibaba',
    'Barangka Ilaya',
    'Barangka Itaas',
    'Buayang Bato',
    'Burol',
    'Daang Bakal',
    'Hagdang Bato Itaas',
    'Hagdang Bato Libis',
    'Harapin ang Bukas',
    'Highway Hills',
    'Hulo',
    'Mabini-J. Rizal',
    'Malamig',
    'Mauway',
    'Namayan',
    'New Zañiga',
    'Old Zañiga',
    'Pag-asa',
    'Plainview',
    'Pleasant Hills',
    'Poblacion',
    'San Jose',
    'Vergara',
    'Wack-Wack Greenhills',
  ],
  Navotas: [
    'Bagumbayan North',
    'Bagumbayan South',
    'Bangculasi',
    'Daanghari',
    'Navotas East',
    'Navotas West',
    'North Bay Blvd. North',
    'North Bay Blvd. South',
    'San Jose',
    'San Roque',
    'Sipac-Almacen',
    'Tangos North',
    'Tangos South',
    'Tanza',
  ],
  Malabon: [
    'Acacia',
    'Baritan',
    'Bayan-bayanan',
    'Catmon',
    'Concepcion',
    'Dampalit',
    'Flores',
    'Hulong Duhat',
    'Ibaba',
    'Longos',
    'Maysilo',
    'Muzon',
    'Niugan',
    'Panghulo',
    'Potrero',
    'San Agustin',
    'Santolan',
    'Tañong',
    'Tinajeros',
    'Tonsuya',
    'Tugatog',
  ],
};

const PH_CITY_LIST = Object.keys(PH_CITIES).sort();

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
            { label: 'Below 12.2V', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Terminal Condition',
          conditions: [
            { label: 'Clean / Tight', color: 'green', action: 'Good' },
            {
              label: 'Minor Corrosion',
              color: 'yellow',
              action: 'Clean & Grease',
            },
            {
              label: 'Heavy Corrosion / Loose',
              color: 'red',
              action: 'Clean / Replace Terminal',
            },
          ],
        },
      ],
    },
    {
      category: 'UNDER THE HOOD',
      items: [
        {
          name: 'Engine Oil Level',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Contaminated',
              color: 'red',
              action: 'Change Oil',
            },
          ],
        },
        {
          name: 'Coolant Level',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Contaminated',
              color: 'red',
              action: 'Flush & Replace',
            },
          ],
        },
        {
          name: 'Brake Fluid Level',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Dark',
              color: 'red',
              action: 'Flush & Replace',
            },
          ],
        },
        {
          name: 'Power Steering Fluid',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Leaking',
              color: 'red',
              action: 'Repair & Replace',
            },
          ],
        },
        {
          name: 'Transmission Fluid',
          conditions: [
            { label: 'Full / Clear', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            { label: 'Very Low / Burnt', color: 'red', action: 'Change' },
          ],
        },
        {
          name: 'Windshield Washer Fluid',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            { label: 'Empty', color: 'red', action: 'Refill' },
          ],
        },
      ],
    },
    {
      category: 'LIGHTS & WIPERS',
      items: [
        {
          name: 'Headlights (Low/High)',
          conditions: [
            { label: 'Working', color: 'green', action: 'Good' },
            { label: 'Dim', color: 'yellow', action: 'Adjust / Clean' },
            { label: 'Not Working', color: 'red', action: 'Replace Bulb' },
          ],
        },
        {
          name: 'Signal / Hazard Lights',
          conditions: [
            { label: 'Working', color: 'green', action: 'Good' },
            { label: 'Intermittent', color: 'yellow', action: 'Check Wiring' },
            { label: 'Not Working', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Brake Lights',
          conditions: [
            { label: 'Working', color: 'green', action: 'Good' },
            { label: 'Dim', color: 'yellow', action: 'Check' },
            { label: 'Not Working', color: 'red', action: 'Replace Bulb' },
          ],
        },
        {
          name: 'Wiper Blades',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Streaking', color: 'yellow', action: 'Monitor' },
            { label: 'Worn / Cracked', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
  ],
  express: [
    {
      category: 'BATTERY TEST',
      items: [
        {
          name: 'Battery Voltage',
          conditions: [
            { label: '12.6V – 12.8V', color: 'green', action: 'Good' },
            { label: '12.2V – 12.6V', color: 'yellow', action: 'Recharge' },
            { label: 'Below 12.2V', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Terminal Condition',
          conditions: [
            { label: 'Clean / Tight', color: 'green', action: 'Good' },
            {
              label: 'Minor Corrosion',
              color: 'yellow',
              action: 'Clean & Grease',
            },
            {
              label: 'Heavy Corrosion / Loose',
              color: 'red',
              action: 'Clean / Replace Terminal',
            },
          ],
        },
      ],
    },
    {
      category: 'UNDER THE HOOD',
      items: [
        {
          name: 'Engine Oil Level',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Contaminated',
              color: 'red',
              action: 'Change Oil',
            },
          ],
        },
        {
          name: 'Coolant Level',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Contaminated',
              color: 'red',
              action: 'Flush & Replace',
            },
          ],
        },
        {
          name: 'Brake Fluid Level',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Dark',
              color: 'red',
              action: 'Flush & Replace',
            },
          ],
        },
        {
          name: 'Power Steering Fluid',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            {
              label: 'Very Low / Leaking',
              color: 'red',
              action: 'Repair & Replace',
            },
          ],
        },
        {
          name: 'Transmission Fluid',
          conditions: [
            { label: 'Full / Clear', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            { label: 'Very Low / Burnt', color: 'red', action: 'Change' },
          ],
        },
        {
          name: 'Windshield Washer Fluid',
          conditions: [
            { label: 'Full', color: 'green', action: 'Good' },
            { label: 'Low', color: 'yellow', action: 'Top Up' },
            { label: 'Empty', color: 'red', action: 'Refill' },
          ],
        },
      ],
    },
    {
      category: 'BELTS & HOSES',
      items: [
        {
          name: 'Drive Belt / Fan Belt',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Cracked / Glazed', color: 'yellow', action: 'Monitor' },
            { label: 'Frayed / Damaged', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Radiator Hoses',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Soft / Swollen', color: 'yellow', action: 'Monitor' },
            { label: 'Cracked / Leaking', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Heater Hoses',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Worn', color: 'yellow', action: 'Monitor' },
            { label: 'Leaking', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
    {
      category: 'BRAKE SYSTEM',
      items: [
        {
          name: 'Front Brake Pads',
          conditions: [
            { label: 'Above 5mm', color: 'green', action: 'Good' },
            {
              label: '3mm – 5mm',
              color: 'yellow',
              action: 'Monitor / Plan Replacement',
            },
            { label: 'Below 3mm', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR'],
        },
        {
          name: 'Rear Brake Pads / Shoes',
          conditions: [
            { label: 'Above 5mm', color: 'green', action: 'Good' },
            {
              label: '3mm – 5mm',
              color: 'yellow',
              action: 'Monitor / Plan Replacement',
            },
            { label: 'Below 3mm', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['RL', 'RR'],
        },
        {
          name: 'Brake Rotor / Disc',
          conditions: [
            { label: 'Smooth', color: 'green', action: 'Good' },
            { label: 'Minor Scoring', color: 'yellow', action: 'Resurface' },
            {
              label: 'Heavy Scoring / Warped',
              color: 'red',
              action: 'Replace',
            },
          ],
        },
      ],
    },
    {
      category: 'TIRES & WHEELS',
      items: [
        {
          name: 'Tire Tread Depth',
          conditions: [
            { label: 'Above 4mm', color: 'green', action: 'Good' },
            { label: '2mm – 4mm', color: 'yellow', action: 'Plan Replacement' },
            { label: 'Below 2mm', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR', 'RL', 'RR'],
        },
        {
          name: 'Tire Pressure',
          conditions: [
            { label: 'Within Spec', color: 'green', action: 'Good' },
            { label: 'Low / High', color: 'yellow', action: 'Adjust' },
            {
              label: 'Very Low / Flat',
              color: 'red',
              action: 'Inflate / Repair',
            },
          ],
        },
        {
          name: 'Tire Condition (Cracks/Bulge)',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Minor Cracks', color: 'yellow', action: 'Monitor' },
            { label: 'Bulge / Severe Damage', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
    {
      category: 'LIGHTS & WIPERS',
      items: [
        {
          name: 'Headlights (Low/High)',
          conditions: [
            { label: 'Working', color: 'green', action: 'Good' },
            { label: 'Dim', color: 'yellow', action: 'Adjust / Clean' },
            { label: 'Not Working', color: 'red', action: 'Replace Bulb' },
          ],
        },
        {
          name: 'Signal / Hazard Lights',
          conditions: [
            { label: 'Working', color: 'green', action: 'Good' },
            { label: 'Intermittent', color: 'yellow', action: 'Check Wiring' },
            { label: 'Not Working', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Brake Lights',
          conditions: [
            { label: 'Working', color: 'green', action: 'Good' },
            { label: 'Dim', color: 'yellow', action: 'Check' },
            { label: 'Not Working', color: 'red', action: 'Replace Bulb' },
          ],
        },
        {
          name: 'Wiper Blades',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Streaking', color: 'yellow', action: 'Monitor' },
            { label: 'Worn / Cracked', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
    {
      category: 'SUSPENSION',
      items: [
        {
          name: 'Front Shock Absorber',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Leaking / Weak', color: 'yellow', action: 'Monitor' },
            { label: 'Failed', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['FL', 'FR'],
        },
        {
          name: 'Rear Shock Absorber',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Leaking / Weak', color: 'yellow', action: 'Monitor' },
            { label: 'Failed', color: 'red', action: 'Replace' },
          ],
          hasPosition: true,
          positions: ['RL', 'RR'],
        },
        {
          name: 'Stabilizer Link',
          conditions: [
            { label: 'Good', color: 'green', action: 'Good' },
            { label: 'Worn', color: 'yellow', action: 'Monitor' },
            { label: 'Loose / Broken', color: 'red', action: 'Replace' },
          ],
        },
        {
          name: 'Ball Joints',
          conditions: [
            { label: 'Tight', color: 'green', action: 'Good' },
            { label: 'Minor Play', color: 'yellow', action: 'Monitor' },
            { label: 'Excessive Play', color: 'red', action: 'Replace' },
          ],
        },
      ],
    },
  ],
  plus: [], // will be set below
};

// Premium Plus = Express + extra categories
INSPECTION_DATA.plus = [
  ...INSPECTION_DATA.express,
  {
    category: 'STEERING SYSTEM',
    items: [
      {
        name: 'Steering Rack',
        conditions: [
          { label: 'No Play / No Leak', color: 'green', action: 'Good' },
          { label: 'Minor Leak', color: 'yellow', action: 'Monitor' },
          {
            label: 'Heavy Leak / Excessive Play',
            color: 'red',
            action: 'Replace',
          },
        ],
      },
      {
        name: 'Tie Rod Ends',
        conditions: [
          { label: 'Tight', color: 'green', action: 'Good' },
          { label: 'Minor Play', color: 'yellow', action: 'Monitor' },
          { label: 'Excessive Play', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'Power Steering Pump',
        conditions: [
          { label: 'Quiet / No Leak', color: 'green', action: 'Good' },
          { label: 'Whining / Minor Leak', color: 'yellow', action: 'Check' },
          { label: 'Failed / Heavy Leak', color: 'red', action: 'Replace' },
        ],
      },
    ],
  },
  {
    category: 'EXHAUST SYSTEM',
    items: [
      {
        name: 'Exhaust Pipe',
        conditions: [
          { label: 'No Leaks / Intact', color: 'green', action: 'Good' },
          { label: 'Minor Rust', color: 'yellow', action: 'Monitor' },
          { label: 'Holes / Heavy Rust', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'Muffler',
        conditions: [
          { label: 'Good', color: 'green', action: 'Good' },
          { label: 'Louder than Normal', color: 'yellow', action: 'Check' },
          { label: 'Damaged / Leaking', color: 'red', action: 'Replace' },
        ],
      },
    ],
  },
  {
    category: 'AIR CONDITIONING',
    items: [
      {
        name: 'A/C Cooling Performance',
        conditions: [
          { label: 'Cold', color: 'green', action: 'Good' },
          { label: 'Not Cold Enough', color: 'yellow', action: 'Recharge' },
          { label: 'Not Working', color: 'red', action: 'Diagnose & Repair' },
        ],
      },
      {
        name: 'A/C Compressor',
        conditions: [
          { label: 'Engaging / Quiet', color: 'green', action: 'Good' },
          { label: 'Noisy', color: 'yellow', action: 'Check' },
          { label: 'Not Engaging', color: 'red', action: 'Repair / Replace' },
        ],
      },
      {
        name: 'Cabin Filter',
        conditions: [
          { label: 'Clean', color: 'green', action: 'Good' },
          { label: 'Dirty', color: 'yellow', action: 'Clean' },
          { label: 'Clogged', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'A/C Belt',
        conditions: [
          { label: 'Good', color: 'green', action: 'Good' },
          { label: 'Cracked', color: 'yellow', action: 'Monitor' },
          { label: 'Frayed / Damaged', color: 'red', action: 'Replace' },
        ],
      },
    ],
  },
  {
    category: 'AIR FILTER & FUEL SYSTEM',
    items: [
      {
        name: 'Air Filter',
        conditions: [
          { label: 'Clean', color: 'green', action: 'Good' },
          { label: 'Dirty', color: 'yellow', action: 'Clean' },
          { label: 'Clogged', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'Fuel Filter',
        conditions: [
          { label: 'Good', color: 'green', action: 'Good' },
          {
            label: 'Due for Replacement',
            color: 'yellow',
            action: 'Plan Replacement',
          },
          { label: 'Clogged', color: 'red', action: 'Replace' },
        ],
      },
      {
        name: 'Spark Plugs',
        conditions: [
          { label: 'Good', color: 'green', action: 'Good' },
          { label: 'Worn', color: 'yellow', action: 'Plan Replacement' },
          { label: 'Fouled / Damaged', color: 'red', action: 'Replace' },
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
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: BRAND.black,
            marginBottom: 4,
            display: 'block',
          }}
        >
          {label}
          {required && <span style={{ color: BRAND.red }}> *</span>}
        </label>
      )}
      <div
        onClick={() => !disabled && setOpen(!open)}
        style={{
          minHeight: 48,
          border: `2px solid ${
            disabled ? BRAND.grayBorder : open ? BRAND.yellow : BRAND.grayBorder
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
            maxHeight: 260,
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
              autoFocus
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
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 14, color: BRAND.gray, fontSize: 14 }}>
                No results
              </div>
            )}
            {filtered.map((o) => (
              <div
                key={o}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                  setSearch('');
                }}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontSize: 15,
                  background: o === value ? BRAND.yellowPale : 'transparent',
                  fontWeight: o === value ? 700 : 400,
                }}
                onMouseEnter={(e) =>
                  (e.target.style.background = BRAND.yellowPale)
                }
                onMouseLeave={(e) =>
                  (e.target.style.background =
                    o === value ? BRAND.yellowPale : 'transparent')
                }
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BigCheckboxGroup({ options, value, onChange, label, required }) {
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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              minHeight: 48,
              padding: '10px 20px',
              borderRadius: 10,
              border: `2px solid ${
                value === o ? BRAND.yellow : BRAND.grayBorder
              }`,
              background: value === o ? BRAND.yellow : BRAND.white,
              color: value === o ? BRAND.black : BRAND.gray,
              fontWeight: value === o ? 800 : 500,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {value === o && <span style={{ marginRight: 6 }}>✓</span>}
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
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (item) => {
    if (value.includes(item)) onChange(value.filter((v) => v !== item));
    else onChange([...value, item]);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: BRAND.black,
            marginBottom: 4,
            display: 'block',
          }}
        >
          {label}
        </label>
      )}
      <div
        onClick={() => setOpen(!open)}
        style={{
          minHeight: 48,
          border: `2px solid ${open ? BRAND.yellow : BRAND.grayBorder}`,
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
              autoFocus
              placeholder="Search parts..."
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
                  background: value.includes(o)
                    ? BRAND.yellowPale
                    : 'transparent',
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    border: `2px solid ${
                      value.includes(o) ? BRAND.yellow : BRAND.grayBorder
                    }`,
                    background: value.includes(o) ? BRAND.yellow : BRAND.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: BRAND.black,
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {value.includes(o) && '✓'}
                </span>
                {o}
              </div>
            ))}
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
}) {
  return (
    <div>
      {label && (
        <label
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: BRAND.black,
            marginBottom: 4,
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
          border: `2px solid ${BRAND.grayBorder}`,
          borderRadius: 10,
          fontSize: 15,
          outline: 'none',
          background: disabled ? BRAND.grayLight : BRAND.white,
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = BRAND.yellow)}
        onBlur={(e) => (e.target.style.borderColor = BRAND.grayBorder)}
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

function TopBar({ user, onLogout, onDashboard, showDashboard = true }) {
  return (
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
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
        {showDashboard &&
          (user.role === 'admin' || user.role === 'service_manager') && (
            <button
              onClick={onDashboard}
              style={{
                background: BRAND.black,
                color: BRAND.white,
                border: 'none',
                padding: '8px 18px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Dashboard
            </button>
          )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.black }}>
          {user.name}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: '4px 10px',
            background: BRAND.black,
            color: BRAND.yellow,
            borderRadius: 6,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {user.role}
        </span>
        <button
          onClick={onLogout}
          style={{
            background: BRAND.white,
            color: BRAND.red,
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function PackageSelectionScreen({ onSelect }) {
  const pkgs = [
    {
      id: 'quick',
      label: 'QUICK',
      desc: 'Basic fluid & visual check',
      icon: '⚡',
      color: '#22C55E',
    },
    {
      id: 'express',
      label: 'EXPRESS',
      desc: 'Comprehensive multi-point inspection',
      icon: '🔧',
      color: BRAND.yellow,
    },
    {
      id: 'plus',
      label: 'PREMIUM PLUS',
      desc: 'Full-system detailed inspection',
      icon: '🏆',
      color: BRAND.red,
    },
  ];
  return (
    <div style={{ padding: '40px 20px', maxWidth: 800, margin: '0 auto' }}>
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
            <span style={{ fontSize: 40 }}>{p.icon}</span>
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

function CustomerVehicleScreen({ data, setData, onNext, brands, models }) {
  const [errors, setErrors] = useState({});
  const availableModels = data.make ? models[data.make] || ['Other'] : [];
  const availableBarangays = data.city ? PH_CITIES[data.city] || [] : [];

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
    if (!data.mobileNo) e.mobileNo = true;
    if (!data.city) e.city = true;
    if (!data.barangay) e.barangay = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };
  const update = (k, v) => {
    setData({ ...data, [k]: v });
    setErrors({ ...errors, [k]: false });
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: BRAND.black,
          marginBottom: 4,
        }}
      >
        Customer & Vehicle Details
      </h2>
      <p style={{ color: BRAND.gray, fontSize: 14, marginBottom: 24 }}>
        Fill in vehicle and customer information
      </p>

      {/* Vehicle Section */}
      <div
        style={{
          background: BRAND.white,
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
          border: `2px solid ${BRAND.grayBorder}`,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: BRAND.black,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              background: BRAND.yellow,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            🚗
          </span>
          Vehicle Details
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 16,
          }}
        >
          <div
            style={{
              border: errors.make ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <SearchableDropdown
              label="Make"
              required
              options={brands}
              value={data.make}
              onChange={(v) => {
                setData({ ...data, make: v, model: '' });
                setErrors({ ...errors, make: false, model: false });
              }}
              placeholder="Select brand..."
            />
          </div>
          <div
            style={{
              border: errors.model ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <SearchableDropdown
              label="Model"
              required
              options={availableModels}
              value={data.model}
              onChange={(v) => update('model', v)}
              placeholder="Select model..."
              disabled={!data.make}
            />
          </div>
          <div
            style={{
              border: errors.year ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <SearchableDropdown
              label="Year"
              required
              options={YEARS}
              value={data.year}
              onChange={(v) => update('year', v)}
              placeholder="Select year..."
            />
          </div>
          <div
            style={{
              border: errors.plateNo ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <TextInput
              label="Plate Number"
              required
              value={data.plateNo || ''}
              onChange={(v) => update('plateNo', v.toUpperCase())}
              placeholder="e.g. ABC 1234"
            />
          </div>
          <BigCheckboxGroup
            label="Transmission"
            required
            options={['Manual', 'A/T', 'CVT']}
            value={data.transmission}
            onChange={(v) => update('transmission', v)}
          />
          <BigCheckboxGroup
            label="Fuel Type"
            required
            options={['Gas', 'Diesel', 'EV/HEV']}
            value={data.fuelType}
            onChange={(v) => update('fuelType', v)}
          />
          <div
            style={{
              border: errors.kmReading ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <SearchableDropdown
              label="KM Reading"
              required
              options={KM_READINGS}
              value={data.kmReading}
              onChange={(v) => update('kmReading', v)}
              placeholder="Select KM..."
            />
          </div>
          <TextInput
            label="Date"
            value={data.date || new Date().toLocaleDateString('en-PH')}
            disabled
          />
        </div>
      </div>

      {/* Customer Section */}
      <div
        style={{
          background: BRAND.white,
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
          border: `2px solid ${BRAND.grayBorder}`,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: BRAND.black,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              background: BRAND.yellow,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            👤
          </span>
          Customer Details
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 16,
          }}
        >
          <BigCheckboxGroup
            label="Title"
            required
            options={['Mr', 'Ms']}
            value={data.title}
            onChange={(v) => update('title', v)}
          />
          <div
            style={{
              border: errors.firstName ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <TextInput
              label="First Name"
              required
              value={data.firstName || ''}
              onChange={(v) => update('firstName', v)}
              placeholder="First name"
            />
          </div>
          <div
            style={{
              border: errors.lastName ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <TextInput
              label="Last Name"
              required
              value={data.lastName || ''}
              onChange={(v) => update('lastName', v)}
              placeholder="Last name"
            />
          </div>
          <TextInput
            label="Company"
            value={data.company || ''}
            onChange={(v) => update('company', v)}
            placeholder="Company (optional)"
          />
          <div
            style={{
              border: errors.mobileNo ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <TextInput
              label="Mobile Number"
              required
              value={data.mobileNo || ''}
              onChange={(v) => update('mobileNo', v)}
              placeholder="+63 9XX XXX XXXX"
            />
          </div>
          <TextInput
            label="Email"
            value={data.email || ''}
            onChange={(v) => update('email', v)}
            placeholder="Email (optional)"
            type="email"
          />
          <div
            style={{
              border: errors.city ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <SearchableDropdown
              label="City / Municipality"
              required
              options={PH_CITY_LIST}
              value={data.city}
              onChange={(v) => {
                update('city', v);
                update('barangay', '');
              }}
              placeholder="Select city..."
            />
          </div>
          <div
            style={{
              border: errors.barangay ? `2px solid ${BRAND.red}` : 'none',
              borderRadius: 12,
            }}
          >
            <SearchableDropdown
              label="Barangay"
              required
              options={availableBarangays}
              value={data.barangay}
              onChange={(v) => update('barangay', v)}
              placeholder="Select barangay..."
              disabled={!data.city}
            />
          </div>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
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

      <div
        style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}
      >
        <PrimaryButton onClick={handleNext}>Next →</PrimaryButton>
      </div>
    </div>
  );
}

function ServiceQuestionsScreen({
  data,
  setData,
  onNext,
  onBack,
  technicians,
}) {
  const [errors, setErrors] = useState({});
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

  const handleNext = () => {
    if (!data.technicianId) {
      setErrors({ technicianId: true });
      return;
    }
    onNext();
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>
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
      <p style={{ color: BRAND.gray, fontSize: 14, marginBottom: 24 }}>
        Capture context and assign technician
      </p>

      <div
        style={{
          background: BRAND.white,
          borderRadius: 16,
          padding: 24,
          border: `2px solid ${BRAND.grayBorder}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
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
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <SearchableDropdown
                options={months}
                value={data.lastPmsMonth}
                onChange={(v) => update('lastPmsMonth', v)}
                placeholder="Month"
              />
            </div>
            <div style={{ flex: 1 }}>
              <SearchableDropdown
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
          options={REPLACED_PARTS}
          value={data.replacedParts || []}
          onChange={(v) => update('replacedParts', v)}
          placeholder="Select parts..."
        />

        <div>
          <label
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: BRAND.black,
              marginBottom: 4,
              display: 'block',
            }}
          >
            Any problems with your vehicle at the moment?
          </label>
          <textarea
            value={data.currentProblems || ''}
            onChange={(e) => update('currentProblems', e.target.value)}
            placeholder="Describe any issues..."
            style={{
              width: '100%',
              minHeight: 100,
              padding: '12px 14px',
              border: `2px solid ${BRAND.grayBorder}`,
              borderRadius: 10,
              fontSize: 15,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div
          style={{
            border: errors.technicianId ? `2px solid ${BRAND.red}` : 'none',
            borderRadius: 12,
            padding: errors.technicianId ? 4 : 0,
          }}
        >
          <SearchableDropdown
            label="Assign Technician"
            required
            options={technicians.filter((t) => t.active).map((t) => t.name)}
            value={data.technicianName}
            onChange={(v) => {
              const tech = technicians.find((t) => t.name === v);
              update('technicianId', tech?.id);
              update('technicianName', v);
            }}
            placeholder="Select technician..."
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 20,
        }}
      >
        <PrimaryButton onClick={onBack} variant="secondary">
          ← Back
        </PrimaryButton>
        <PrimaryButton onClick={handleNext}>Next →</PrimaryButton>
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
}) {
  const cat = categories[currentCategoryIdx];
  const isFirst = currentCategoryIdx === 0;
  const isLast = currentCategoryIdx === categories.length - 1;

  const getKey = (catName, itemName) => `${catName}::${itemName}`;

  const selectCondition = (itemName, condIdx) => {
    const key = getKey(cat.category, itemName);
    const item = cat.items.find((i) => i.name === itemName);
    const cond = item.conditions[condIdx];
    setFindings((prev) => ({
      ...prev,
      [key]: {
        conditionIdx: condIdx,
        condition: cond.label,
        action: cond.action,
        color: cond.color,
      },
    }));
  };

  const togglePosition = (itemName, pos) => {
    const key = getKey(cat.category, itemName) + '::positions';
    setFindings((prev) => {
      const current = prev[key] || [];
      if (current.includes(pos))
        return { ...prev, [key]: current.filter((p) => p !== pos) };
      return { ...prev, [key]: [...current, pos] };
    });
  };

  const progress = ((currentCategoryIdx + 1) / categories.length) * 100;

  return (
    <div
      style={{ padding: '20px 20px 100px', maxWidth: 800, margin: '0 auto' }}
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
          <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.black }}>
            {Math.round(progress)}%
          </span>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cat.items.map((item) => {
          const key = getKey(cat.category, item.name);
          const finding = findings[key];
          const posKey = key + '::positions';
          const positions = findings[posKey] || [];

          return (
            <div
              key={item.name}
              style={{
                background: BRAND.white,
                borderRadius: 14,
                border: `2px solid ${
                  finding ? colorMap[finding.color] : BRAND.grayBorder
                }`,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: `1px solid ${BRAND.grayBorder}`,
                }}
              >
                <div
                  style={{ fontWeight: 800, fontSize: 15, color: BRAND.black }}
                >
                  {item.name}
                </div>
              </div>

              {/* Position buttons */}
              {item.hasPosition && (
                <div
                  style={{
                    padding: '10px 18px',
                    borderBottom: `1px solid ${BRAND.grayBorder}`,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: BRAND.gray,
                      marginRight: 4,
                      alignSelf: 'center',
                    }}
                  >
                    Position:
                  </span>
                  {item.positions.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => togglePosition(item.name, pos)}
                      style={{
                        minWidth: 52,
                        minHeight: 44,
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 14,
                        border: `2px solid ${
                          positions.includes(pos)
                            ? BRAND.yellow
                            : BRAND.grayBorder
                        }`,
                        background: positions.includes(pos)
                          ? BRAND.yellow
                          : BRAND.white,
                        color: positions.includes(pos)
                          ? BRAND.black
                          : BRAND.gray,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              )}

              {/* Conditions */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {item.conditions.map((cond, ci) => {
                  const selected = finding?.conditionIdx === ci;
                  return (
                    <div
                      key={ci}
                      onClick={() => selectCondition(item.name, ci)}
                      style={{
                        padding: '14px 18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom:
                          ci < item.conditions.length - 1
                            ? `1px solid ${BRAND.grayBorder}`
                            : 'none',
                        background: selected
                          ? bgColorMap[cond.color]
                          : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            flexShrink: 0,
                            border: `2px solid ${
                              selected ? colorMap[cond.color] : BRAND.grayBorder
                            }`,
                            background: selected
                              ? colorMap[cond.color]
                              : BRAND.white,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: BRAND.white,
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {selected && '✓'}
                        </div>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: selected ? 700 : 400,
                            color: BRAND.black,
                          }}
                        >
                          {cond.label}
                        </span>
                      </div>

                      {/* Action highlight */}
                      <div
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 13,
                          background: selected
                            ? colorMap[cond.color]
                            : BRAND.grayLight,
                          color: selected ? BRAND.white : BRAND.gray,
                          minWidth: 80,
                          textAlign: 'center',
                          transition: 'all 0.15s',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {cond.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: BRAND.white,
          borderTop: `2px solid ${BRAND.grayBorder}`,
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          zIndex: 99,
        }}
      >
        <PrimaryButton
          onClick={
            isFirst
              ? onBack
              : () => setCurrentCategoryIdx(currentCategoryIdx - 1)
          }
          variant="secondary"
        >
          ← Back
        </PrimaryButton>
        <PrimaryButton
          onClick={
            isLast
              ? onFinish
              : () => setCurrentCategoryIdx(currentCategoryIdx + 1)
          }
        >
          {isLast ? 'Finish Inspection →' : 'Next Category →'}
        </PrimaryButton>
      </div>
    </div>
  );
}

function TechCommentScreen({ comment, setComment, onFinish, onBack }) {
  return (
    <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>
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
          border: `2px solid ${BRAND.grayBorder}`,
        }}
      >
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Type your comment or observations here..."
          style={{
            width: '100%',
            minHeight: 180,
            padding: '14px 16px',
            border: `2px solid ${BRAND.grayBorder}`,
            borderRadius: 12,
            fontSize: 16,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.target.style.borderColor = BRAND.yellow)}
          onBlur={(e) => (e.target.style.borderColor = BRAND.grayBorder)}
        />
        <div style={{ marginTop: 12, fontSize: 12, color: BRAND.gray }}>
          💡 Tip: Be specific about any findings or recommendations
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 20,
        }}
      >
        <PrimaryButton onClick={onBack} variant="secondary">
          ← Back
        </PrimaryButton>
        <PrimaryButton onClick={onFinish}>
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
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
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

function AdminDashboard({
  inspections,
  onView,
  onNewInspection,
  technicians,
  brands,
  models,
  onAddTechnician,
  onAddBrand,
  onAddModel,
}) {
  const [search, setSearch] = useState('');
  const [filterPkg, setFilterPkg] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [showAddTech, setShowAddTech] = useState(false);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelBrand, setNewModelBrand] = useState('');

  const filtered = inspections.filter((ins) => {
    if (
      search &&
      !(ins.rif + ' ' + ins.customerName + ' ' + ins.technicianName)
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    if (filterPkg && ins.packageType !== filterPkg) return false;
    if (filterTech && ins.technicianName !== filterTech) return false;
    return true;
  });

  const pkgLabel = { quick: 'QUICK', express: 'EXPRESS', plus: 'PREMIUM PLUS' };
  const pkgColor = {
    quick: BRAND.green,
    express: BRAND.yellowStatus,
    plus: BRAND.red,
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
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
            {inspections.length} inspections completed
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PrimaryButton
            onClick={() => setShowAddTech(true)}
            variant="secondary"
            style={{ fontSize: 12, padding: '8px 14px', minHeight: 40 }}
          >
            + Technician
          </PrimaryButton>
          <PrimaryButton
            onClick={() => setShowAddBrand(true)}
            variant="secondary"
            style={{ fontSize: 12, padding: '8px 14px', minHeight: 40 }}
          >
            + Brand
          </PrimaryButton>
          <PrimaryButton
            onClick={() => setShowAddModel(true)}
            variant="secondary"
            style={{ fontSize: 12, padding: '8px 14px', minHeight: 40 }}
          >
            + Model
          </PrimaryButton>
          <PrimaryButton
            onClick={onNewInspection}
            style={{ fontSize: 12, padding: '8px 14px', minHeight: 40 }}
          >
            + New Inspection
          </PrimaryButton>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}
      >
        <input
          placeholder="Search RIF, customer, technician..."
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
          <option value="plus">Premium Plus</option>
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
      </div>

      {/* Table */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 14,
          border: `2px solid ${BRAND.grayBorder}`,
        }}
      >
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: BRAND.black }}>
              {[
                'RIF #',
                'Date',
                'Customer',
                'Technician',
                'Package',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
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
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
            {filtered.map((ins, i) => (
              <tr
                key={ins.rif}
                style={{
                  background: i % 2 === 0 ? BRAND.white : BRAND.grayLight,
                  cursor: 'pointer',
                }}
                onClick={() => onView(ins)}
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
                <td style={{ padding: '14px 16px' }}>{ins.date}</td>
                <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                  {ins.customerName}
                </td>
                <td style={{ padding: '14px 16px' }}>{ins.technicianName}</td>
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(ins);
                      }}
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Technician Modal */}
      {showAddTech && (
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
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '100%',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              Add Technician
            </h3>
            <TextInput
              label="Full Name"
              required
              value={newTechName}
              onChange={setNewTechName}
              placeholder="Technician name"
            />
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 20,
                justifyContent: 'flex-end',
              }}
            >
              <PrimaryButton
                onClick={() => {
                  setShowAddTech(false);
                  setNewTechName('');
                }}
                variant="secondary"
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                onClick={() => {
                  if (newTechName.trim()) {
                    onAddTechnician(newTechName.trim());
                    setNewTechName('');
                    setShowAddTech(false);
                  }
                }}
              >
                Add
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
      {showAddBrand && (
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
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '100%',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              Add Car Brand
            </h3>
            <TextInput
              label="Brand Name"
              required
              value={newBrandName}
              onChange={setNewBrandName}
              placeholder="e.g. Volvo"
            />
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 20,
                justifyContent: 'flex-end',
              }}
            >
              <PrimaryButton
                onClick={() => {
                  setShowAddBrand(false);
                  setNewBrandName('');
                }}
                variant="secondary"
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                onClick={() => {
                  if (newBrandName.trim()) {
                    onAddBrand(newBrandName.trim());
                    setNewBrandName('');
                    setShowAddBrand(false);
                  }
                }}
              >
                Add
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
      {showAddModel && (
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
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '100%',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              Add Car Model
            </h3>
            <div style={{ marginBottom: 16 }}>
              <SearchableDropdown
                label="Brand"
                required
                options={brands}
                value={newModelBrand}
                onChange={setNewModelBrand}
                placeholder="Select brand..."
              />
            </div>
            <TextInput
              label="Model Name"
              required
              value={newModelName}
              onChange={setNewModelName}
              placeholder="e.g. Corolla Cross"
            />
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 20,
                justifyContent: 'flex-end',
              }}
            >
              <PrimaryButton
                onClick={() => {
                  setShowAddModel(false);
                  setNewModelName('');
                  setNewModelBrand('');
                }}
                variant="secondary"
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                onClick={() => {
                  if (newModelName.trim() && newModelBrand) {
                    onAddModel(newModelBrand, newModelName.trim());
                    setNewModelName('');
                    setNewModelBrand('');
                    setShowAddModel(false);
                  }
                }}
              >
                Add
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceDecisionScreen({ inspection, onSave, onBack }) {
  const [decisions, setDecisions] = useState({});

  // Get yellow and red findings
  const actionable = [];
  if (inspection.findings) {
    const categories = INSPECTION_DATA[inspection.packageType] || [];
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const key = `${cat.category}::${item.name}`;
        const finding = inspection.findings[key];
        if (
          finding &&
          (finding.color === 'yellow' || finding.color === 'red')
        ) {
          actionable.push({
            category: cat.category,
            item: item.name,
            ...finding,
          });
        }
      });
    });
  }

  const greenCount = Object.values(inspection.findings || {}).filter(
    (f) => f.color === 'green'
  ).length;
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

  const printInspection = () => {
    const printWindow = window.open('', '_blank');
    const findings = inspection.findings || {};
    const categories = INSPECTION_DATA[inspection.packageType] || [];
    const pkgLabel = {
      quick: 'QUICK',
      express: 'EXPRESS',
      plus: 'PREMIUM PLUS',
    };

    let findingsHTML = '';
    categories.forEach((cat) => {
      let rows = '';
      cat.items.forEach((item) => {
        const key = `${cat.category}::${item.name}`;
        const f = findings[key];
        const posKey = key + '::positions';
        const positions = findings[posKey];
        const posStr =
          positions && positions.length > 0 ? ` (${positions.join(', ')})` : '';
        rows += `<tr>
          <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">${
            item.name
          }${posStr}</td>
          <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;">${
            f ? f.condition : '—'
          }</td>
          <td style="padding:6px 10px;border:1px solid #ccc;font-size:12px;text-align:center;">
            ${
              f
                ? `<span style="display:inline-block;padding:3px 12px;border-radius:4px;color:#fff;font-weight:700;font-size:11px;background:${
                    f.color === 'green'
                      ? '#22C55E'
                      : f.color === 'yellow'
                      ? '#F59E0B'
                      : '#E31E24'
                  }">${f.action}</span>`
                : '—'
            }
          </td>
        </tr>`;
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

    printWindow.document
      .write(`<!DOCTYPE html><html><head><title>Rapide Inspection - ${
      inspection.rif
    }</title>
      <style>@media print { body { margin: 0; } } body { font-family: Arial, sans-serif; margin: 20px; color: #1A1A1A; }</style>
    </head><body>
      <div style="text-align:center;margin-bottom:16px;">
        <div style="background:#FFD100;padding:16px;border-radius:8px;display:inline-block;">
          <div style="font-family:'Arial Black',sans-serif;font-size:32px;font-weight:900;font-style:italic;color:#1A1A1A;letter-spacing:-1px;">Rapidé</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:#1A1A1A;text-transform:uppercase;">Auto Service Experts</div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:16px;"><strong style="font-size:16px;">VEHICLE INSPECTION REPORT</strong></div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr><td style="padding:4px 8px;font-size:12px;width:25%;"><strong>RIF #:</strong> ${
          inspection.rif
        }</td>
            <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Date:</strong> ${
              inspection.date
            }</td>
            <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Package:</strong> ${
              pkgLabel[inspection.packageType]
            }</td>
            <td style="padding:4px 8px;font-size:12px;width:25%;"><strong>Technician:</strong> ${
              inspection.technicianName
            }</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ccc;">
        <tr style="background:#f5f5f5;"><td colspan="4" style="padding:8px 10px;font-weight:800;font-size:13px;">VEHICLE INFORMATION</td></tr>
        <tr><td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Make:</strong> ${
          inspection.customerData?.make || ''
        }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Model:</strong> ${
              inspection.customerData?.model || ''
            }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Year:</strong> ${
              inspection.customerData?.year || ''
            }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Plate:</strong> ${
              inspection.customerData?.plateNo || ''
            }</td></tr>
        <tr><td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Trans:</strong> ${
          inspection.customerData?.transmission || ''
        }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Fuel:</strong> ${
              inspection.customerData?.fuelType || ''
            }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;" colspan="2"><strong>KM:</strong> ${
              inspection.customerData?.kmReading || ''
            }</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #ccc;">
        <tr style="background:#f5f5f5;"><td colspan="4" style="padding:8px 10px;font-weight:800;font-size:13px;">CUSTOMER INFORMATION</td></tr>
        <tr><td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Name:</strong> ${
          inspection.customerData?.title || ''
        } ${inspection.customerData?.firstName || ''} ${
      inspection.customerData?.lastName || ''
    }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Mobile:</strong> ${
              inspection.customerData?.mobileNo || ''
            }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;" colspan="2"><strong>Email:</strong> ${
              inspection.customerData?.email || ''
            }</td></tr>
        <tr><td style="padding:4px 10px;font-size:12px;border:1px solid #eee;"><strong>Company:</strong> ${
          inspection.customerData?.company || ''
        }</td>
            <td style="padding:4px 10px;font-size:12px;border:1px solid #eee;" colspan="3"><strong>Location:</strong> ${
              inspection.customerData?.barangay || ''
            }, ${inspection.customerData?.city || ''}</td></tr>
      </table>
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div style="flex:1;text-align:center;padding:10px;background:#DCFCE7;border-radius:6px;"><div style="font-size:24px;font-weight:900;color:#22C55E;">${greenCount}</div><div style="font-size:11px;font-weight:700;color:#22C55E;">GOOD</div></div>
        <div style="flex:1;text-align:center;padding:10px;background:#FEF3C7;border-radius:6px;"><div style="font-size:24px;font-weight:900;color:#F59E0B;">${yellowCount}</div><div style="font-size:11px;font-weight:700;color:#F59E0B;">WARNING</div></div>
        <div style="flex:1;text-align:center;padding:10px;background:#FEE2E2;border-radius:6px;"><div style="font-size:24px;font-weight:900;color:#E31E24;">${redCount}</div><div style="font-size:11px;font-weight:700;color:#E31E24;">CRITICAL</div></div>
      </div>
      ${findingsHTML}
      ${
        inspection.techComment
          ? `<div style="margin-top:16px;padding:12px;border:1px solid #ccc;border-radius:6px;"><strong style="font-size:12px;">Technician Comment:</strong><div style="font-size:12px;margin-top:4px;">${inspection.techComment}</div></div>`
          : ''
      }
      <div style="margin-top:40px;display:flex;justify-content:space-between;">
        <div style="text-align:center;width:40%;"><div style="border-top:1px solid #1A1A1A;padding-top:4px;font-size:11px;">Customer Signature</div></div>
        <div style="text-align:center;width:40%;"><div style="border-top:1px solid #1A1A1A;padding-top:4px;font-size:11px;">Authorized by</div></div>
      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
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
        <PrimaryButton
          onClick={printInspection}
          variant="dark"
          style={{ fontSize: 13, padding: '10px 20px', minHeight: 42 }}
        >
          🖨️ Print / Download
        </PrimaryButton>
      </div>

      {/* Header Info */}
      <div
        style={{
          background: BRAND.white,
          borderRadius: 14,
          padding: 20,
          border: `2px solid ${BRAND.grayBorder}`,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
          <div style={{ fontSize: 32, fontWeight: 900, color: BRAND.green }}>
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
          <div style={{ fontSize: 32, fontWeight: 900, color: BRAND.red }}>
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
// MAIN APP
// ============================================================
export default function App() {
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
  const [brands, setBrands] = useState([...CAR_BRANDS]);
  const [models, setModels] = useState({ ...CAR_MODELS });
  const [technicians, setTechnicians] = useState([
    { id: 1, name: 'Pedro Garcia', active: true },
    { id: 2, name: 'Marco Reyes', active: true },
    { id: 3, name: 'Carlos Mendoza', active: true },
    { id: 4, name: 'Miguel Torres', active: true },
  ]);

  const handleLogin = (u) => {
    setUser(u);
    setScreen('packageSelect');
  };
  const handleLogout = () => {
    setUser(null);
    setScreen('login');
  };

  const handlePackageSelect = (pkg) => {
    setPackageType(pkg);
    setCustomerData({ date: new Date().toLocaleDateString('en-PH') });
    setServiceData({});
    setFindings({});
    setCurrentCatIdx(0);
    setTechComment('');
    setScreen('customerVehicle');
  };

  const handleSubmitInspection = () => {
    const rif = generateRIF();
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
      status: 'submitted',
    };
    setInspections((prev) => [newInspection, ...prev]);
    setShowSubmitModal(false);
    setScreen('packageSelect');
  };

  const categories = INSPECTION_DATA[packageType] || [];

  const handleAddTechnician = (name) => {
    setTechnicians((prev) => [...prev, { id: Date.now(), name, active: true }]);
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BRAND.grayLight,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {screen === 'login' && <LoginScreen onLogin={handleLogin} />}

      {screen !== 'login' && user && (
        <TopBar
          user={user}
          onLogout={handleLogout}
          onDashboard={() => {
            setViewingInspection(null);
            setScreen('dashboard');
          }}
          showDashboard={screen !== 'dashboard'}
        />
      )}

      {screen === 'packageSelect' && (
        <PackageSelectionScreen onSelect={handlePackageSelect} />
      )}

      {screen === 'customerVehicle' && (
        <CustomerVehicleScreen
          data={customerData}
          setData={setCustomerData}
          onNext={() => setScreen('serviceQuestions')}
          brands={brands}
          models={models}
        />
      )}

      {screen === 'serviceQuestions' && (
        <ServiceQuestionsScreen
          data={serviceData}
          setData={setServiceData}
          onNext={() => {
            setCurrentCatIdx(0);
            setScreen('inspection');
          }}
          onBack={() => setScreen('customerVehicle')}
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
          onFinish={() => setScreen('techComment')}
          onBack={() => setScreen('serviceQuestions')}
        />
      )}

      {screen === 'techComment' && (
        <TechCommentScreen
          comment={techComment}
          setComment={setTechComment}
          onFinish={() => setShowSubmitModal(true)}
          onBack={() => {
            setCurrentCatIdx(categories.length - 1);
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

      {screen === 'dashboard' && !viewingInspection && (
        <AdminDashboard
          inspections={inspections}
          onView={(ins) => setViewingInspection(ins)}
          onNewInspection={() => setScreen('packageSelect')}
          technicians={technicians}
          brands={brands}
          models={models}
          onAddTechnician={handleAddTechnician}
          onAddBrand={handleAddBrand}
          onAddModel={handleAddModel}
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
