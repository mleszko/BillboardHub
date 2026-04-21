// Realistic mockup data for a Podlaskie / Białystok outdoor advertising operator.

export type ContractStatus = "active" | "expiring_soon" | "critical" | "vacant";

export interface Billboard {
  id: string;
  code: string; // internal code e.g. BIA-014
  city: string;
  address: string;
  lat: number;
  lng: number;
  type: "Backlight" | "LED" | "Frontlight" | "Citylight";
  size: string; // 12x4 m
  monthlyPrice: number; // PLN
  status: ContractStatus;
  client?: string;
  clientLogo?: string;
  contractStart?: string; // ISO
  contractEnd?: string; // ISO
  /** True when backend stored a placeholder end date (no real expiry in import). */
  expiryUnknown?: boolean;
  creativePhoto: string; // URL
  dailyImpressions: number;
}

const photo = (seed: string) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=800&q=70`;

// Billboard creative photos (Unsplash, outdoor / billboard themed)
const photos = [
  photo("photo-1551024506-0bccd828d307"),
  photo("photo-1568430462989-44163eb1752f"),
  photo("photo-1542744173-8e7e53415bb0"),
  photo("photo-1556761175-5973dc0f32e7"),
  photo("photo-1611532736597-de2d4265fba3"),
  photo("photo-1567446537708-ac4aa75c9c28"),
  photo("photo-1587613991119-fbbe8e90531d"),
  photo("photo-1604881991720-f91add269bed"),
];

const today = new Date();
const daysFromNow = (d: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + d);
  return date.toISOString();
};

export const billboards: Billboard[] = [
  {
    id: "bb-1",
    code: "BIA-001",
    city: "Białystok",
    address: "al. Jana Pawła II 57",
    lat: 53.1234,
    lng: 23.1456,
    type: "LED",
    size: "12 × 4 m",
    monthlyPrice: 8400,
    status: "active",
    client: "Biedronka",
    contractStart: daysFromNow(-200),
    contractEnd: daysFromNow(165),
    creativePhoto: photos[0],
    dailyImpressions: 48000,
  },
  {
    id: "bb-2",
    code: "BIA-002",
    city: "Białystok",
    address: "ul. Lipowa 32",
    lat: 53.1325,
    lng: 23.1633,
    type: "Backlight",
    size: "6 × 3 m",
    monthlyPrice: 4200,
    status: "critical",
    client: "Orange Polska",
    contractStart: daysFromNow(-360),
    contractEnd: daysFromNow(12),
    creativePhoto: photos[1],
    dailyImpressions: 32000,
  },
  {
    id: "bb-3",
    code: "BIA-003",
    city: "Białystok",
    address: "ul. Sienkiewicza 86",
    lat: 53.1411,
    lng: 23.1582,
    type: "Frontlight",
    size: "12 × 4 m",
    monthlyPrice: 6100,
    status: "expiring_soon",
    client: "PKO BP",
    contractStart: daysFromNow(-340),
    contractEnd: daysFromNow(48),
    creativePhoto: photos[2],
    dailyImpressions: 41000,
  },
  {
    id: "bb-4",
    code: "BIA-004",
    city: "Białystok",
    address: "Rondo Lussy",
    lat: 53.1287,
    lng: 23.1722,
    type: "LED",
    size: "8 × 4 m",
    monthlyPrice: 9200,
    status: "active",
    client: "T-Mobile",
    contractStart: daysFromNow(-95),
    contractEnd: daysFromNow(270),
    creativePhoto: photos[3],
    dailyImpressions: 56000,
  },
  {
    id: "bb-5",
    code: "BIA-005",
    city: "Białystok",
    address: "ul. Wysockiego 67",
    lat: 53.1502,
    lng: 23.1802,
    type: "Backlight",
    size: "6 × 3 m",
    monthlyPrice: 3800,
    status: "vacant",
    creativePhoto: photos[4],
    dailyImpressions: 22000,
  },
  {
    id: "bb-6",
    code: "BIA-006",
    city: "Białystok",
    address: "al. Piłsudskiego 11",
    lat: 53.1281,
    lng: 23.1559,
    type: "Citylight",
    size: "1.2 × 1.8 m",
    monthlyPrice: 1900,
    status: "active",
    client: "Żabka",
    contractStart: daysFromNow(-50),
    contractEnd: daysFromNow(310),
    creativePhoto: photos[5],
    dailyImpressions: 18000,
  },
  {
    id: "bb-7",
    code: "BIA-007",
    city: "Białystok",
    address: "ul. Zwierzyniecka 10",
    lat: 53.1186,
    lng: 23.1389,
    type: "Frontlight",
    size: "12 × 3 m",
    monthlyPrice: 5400,
    status: "critical",
    client: "Lidl Polska",
    contractStart: daysFromNow(-355),
    contractEnd: daysFromNow(5),
    creativePhoto: photos[6],
    dailyImpressions: 36000,
  },
  {
    id: "bb-8",
    code: "SUW-001",
    city: "Suwałki",
    address: "ul. Kościuszki 71",
    lat: 54.1011,
    lng: 22.9305,
    type: "Backlight",
    size: "6 × 3 m",
    monthlyPrice: 3200,
    status: "active",
    client: "Allegro",
    contractStart: daysFromNow(-140),
    contractEnd: daysFromNow(220),
    creativePhoto: photos[7],
    dailyImpressions: 17000,
  },
  {
    id: "bb-9",
    code: "SUW-002",
    city: "Suwałki",
    address: "al. Sejneńska 34",
    lat: 54.0976,
    lng: 22.9412,
    type: "LED",
    size: "8 × 4 m",
    monthlyPrice: 5800,
    status: "expiring_soon",
    client: "InPost",
    contractStart: daysFromNow(-310),
    contractEnd: daysFromNow(55),
    creativePhoto: photos[0],
    dailyImpressions: 21000,
  },
  {
    id: "bb-10",
    code: "SUW-003",
    city: "Suwałki",
    address: "ul. Noniewicza 91",
    lat: 54.1073,
    lng: 22.9286,
    type: "Frontlight",
    size: "6 × 3 m",
    monthlyPrice: 2900,
    status: "vacant",
    creativePhoto: photos[1],
    dailyImpressions: 15000,
  },
  {
    id: "bb-11",
    code: "LOM-001",
    city: "Łomża",
    address: "al. Legionów 125",
    lat: 53.1781,
    lng: 22.0731,
    type: "Backlight",
    size: "12 × 4 m",
    monthlyPrice: 4600,
    status: "active",
    client: "Santander Bank",
    contractStart: daysFromNow(-180),
    contractEnd: daysFromNow(185),
    creativePhoto: photos[2],
    dailyImpressions: 23000,
  },
  {
    id: "bb-12",
    code: "LOM-002",
    city: "Łomża",
    address: "ul. Wojska Polskiego 161",
    lat: 53.1842,
    lng: 22.0598,
    type: "Frontlight",
    size: "6 × 3 m",
    monthlyPrice: 3100,
    status: "expiring_soon",
    client: "Cyfrowy Polsat",
    contractStart: daysFromNow(-320),
    contractEnd: daysFromNow(40),
    creativePhoto: photos[3],
    dailyImpressions: 19500,
  },
  {
    id: "bb-13",
    code: "AUG-001",
    city: "Augustów",
    address: "ul. Wojska Polskiego 23",
    lat: 53.8429,
    lng: 22.9784,
    type: "Citylight",
    size: "1.2 × 1.8 m",
    monthlyPrice: 1500,
    status: "active",
    client: "PZU",
    contractStart: daysFromNow(-60),
    contractEnd: daysFromNow(305),
    creativePhoto: photos[4],
    dailyImpressions: 9800,
  },
  {
    id: "bb-14",
    code: "AUG-002",
    city: "Augustów",
    address: "Rynek Zygmunta Augusta",
    lat: 53.8454,
    lng: 22.9789,
    type: "Backlight",
    size: "6 × 3 m",
    monthlyPrice: 2700,
    status: "critical",
    client: "Bank Pekao",
    contractStart: daysFromNow(-365),
    contractEnd: daysFromNow(-3),
    creativePhoto: photos[5],
    dailyImpressions: 12500,
  },
  {
    id: "bb-15",
    code: "BIA-008",
    city: "Białystok",
    address: "ul. Hetmańska 40",
    lat: 53.1098,
    lng: 23.1671,
    type: "LED",
    size: "12 × 4 m",
    monthlyPrice: 8900,
    status: "active",
    client: "Media Markt",
    contractStart: daysFromNow(-110),
    contractEnd: daysFromNow(255),
    creativePhoto: photos[6],
    dailyImpressions: 51000,
  },
];

export const cities = Array.from(new Set(billboards.map((b) => b.city))).sort();
export const clients = Array.from(
  new Set(billboards.map((b) => b.client).filter(Boolean) as string[]),
).sort();

export function statusFromContract(b: Billboard): ContractStatus {
  if (!b.contractEnd) return "vacant";
  const days = Math.ceil((new Date(b.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return "critical";
  if (days <= 60) return "expiring_soon";
  return "active";
}

export function daysRemaining(b: Billboard): number | null {
  if (b.expiryUnknown || !b.contractEnd) return null;
  return Math.ceil((new Date(b.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function formatPLN(n: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
}

export const stats = () => {
  const total = billboards.length;
  const occupied = billboards.filter((b) => b.client).length;
  const monthlyRevenue = billboards.filter((b) => b.client).reduce((s, b) => s + b.monthlyPrice, 0);
  const expiring30 = billboards.filter((b) => {
    const d = daysRemaining(b);
    return d !== null && d <= 30;
  }).length;
  return {
    total,
    occupancy: Math.round((occupied / total) * 100),
    monthlyRevenue,
    expiring30,
  };
};

export const revenueTrend = [
  { month: "Maj", revenue: 58200 },
  { month: "Cze", revenue: 61400 },
  { month: "Lip", revenue: 63800 },
  { month: "Sie", revenue: 62100 },
  { month: "Wrz", revenue: 67500 },
  { month: "Paź", revenue: 71200 },
  { month: "Lis", revenue: 74600 },
];

export const recentActivity = [
  {
    id: 1,
    type: "payment",
    text: "T-Mobile opłacił fakturę FV/2025/11/142",
    amount: 9200,
    when: "2h temu",
  },
  {
    id: 2,
    type: "renewal",
    text: "PKO BP — wysłano propozycję przedłużenia (BIA-003)",
    when: "5h temu",
  },
  { id: 3, type: "alert", text: "Lidl Polska — umowa wygasa za 5 dni (BIA-007)", when: "wczoraj" },
  { id: 4, type: "ai", text: "AI: nowa umowa Allegro przetworzona (SUW-001)", when: "wczoraj" },
  {
    id: 5,
    type: "payment",
    text: "Biedronka — płatność potwierdzona",
    amount: 8400,
    when: "2 dni temu",
  },
];
