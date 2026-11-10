export const catalog = [
  {
    id: "aventus",
    brand: "Creed",
    name: "Aventus",
    gender: "men",
    url: "https://www.fragrantica.com/perfume/Creed/Aventus-9828.html",
    color: "#394745",
  },
  {
    id: "baccarat",
    brand: "Maison Francis Kurkdjian",
    name: "Baccarat Rouge 540",
    gender: "unisex",
    url: "https://www.fragrantica.com/perfume/Maison-Francis-Kurkdjian/Baccarat-Rouge-540-33519.html",
    color: "#b37961",
  },
  {
    id: "sauvage",
    brand: "Dior",
    name: "Sauvage Eau de Parfum",
    gender: "men",
    url: "https://www.fragrantica.com/perfume/Dior/Sauvage-Eau-de-Parfum-48100.html",
    color: "#263d4b",
  },
  {
    id: "libre",
    brand: "Yves Saint Laurent",
    name: "Libre Eau de Parfum",
    gender: "women",
    url: "https://www.fragrantica.com/perfume/Yves-Saint-Laurent/Libre-56077.html",
    color: "#d2a45f",
  },
  {
    id: "noir",
    brand: "Tom Ford",
    name: "Oud Wood",
    gender: "unisex",
    url: "https://www.fragrantica.com/perfume/Tom-Ford/Oud-Wood-1826.html",
    color: "#5c5350",
  },
  {
    id: "chance",
    brand: "Chanel",
    name: "Chance Eau Tendre",
    gender: "women",
    url: "https://www.fragrantica.com/perfume/Chanel/Chance-Eau-Tendre-8069.html",
    color: "#c4999c",
  },
  {
    id: "layton",
    brand: "Parfums de Marly",
    name: "Layton",
    gender: "unisex",
    url: "https://www.fragrantica.com/perfume/Parfums-de-Marly/Layton-39314.html",
    color: "#42516b",
  },
  {
    id: "royal",
    brand: "French Avenue",
    name: "Royal Blend",
    gender: "unisex",
    url: "https://www.fragrantica.com/search/?query=French%20Avenue%20Royal%20Blend",
    color: "#9e6636",
  },
  {
    id: "bleu",
    brand: "Chanel",
    name: "Bleu de Chanel Eau de Parfum",
    gender: "men",
    url: "https://www.fragrantica.com/perfume/Chanel/Bleu-de-Chanel-Eau-de-Parfum-25967.html",
    color: "#24333d",
  },
  {
    id: "eros",
    brand: "Versace",
    name: "Eros",
    gender: "men",
    url: "https://www.fragrantica.com/perfume/Versace/Eros-16657.html",
    color: "#417f80",
  },
  {
    id: "angels",
    brand: "Kilian",
    name: "Angels’ Share",
    gender: "unisex",
    url: "https://www.fragrantica.com/perfume/By-Kilian/Angels-Share-62615.html",
    color: "#b07c47",
  },
  {
    id: "black",
    brand: "Yves Saint Laurent",
    name: "Black Opium",
    gender: "women",
    url: "https://www.fragrantica.com/perfume/Yves-Saint-Laurent/Black-Opium-25324.html",
    color: "#4e414a",
  },
];
export function identify(query: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ");
  return catalog
    .map((p) => {
      const label = norm(p.brand + " " + p.name);
      const words = label.split(" ");
      const score =
        tokens.reduce(
          (s, t) =>
            s +
            (words.some((w) => w === t)
              ? 1
              : words.some((w) => w.startsWith(t))
                ? 0.75
                : label.includes(t)
                  ? 0.5
                  : 0),
          0,
        ) / tokens.length;
      return { ...p, score };
    })
    .filter((p) => p.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
export type Listing = {
  id: string;
  ownerId?: string;
  seller: string;
  phone?: string;
  telegram: string;
  city: string;
  brand: string;
  name: string;
  gender: string;
  size: number;
  remaining: number;
  price: number;
  condition: string;
  description: string;
  photos: string[];
  status: string;
  createdAt: number;
  likeCount?: number;
  commentCount?: number;
  demo?: boolean;
  profileId?: string | null;
  moderationStatus?: string;
};
export const demos: Listing[] = catalog
  .slice(0, 8)
  .map((p, i) => ({
    id: "demo-" + p.id,
    brand: p.brand,
    name: p.name,
    gender: p.gender,
    seller: ["Aziz", "Malika", "Javohir", "Madina"][i % 4],
    telegram: "",
    city: [
      "Tashkent",
      "Tashkent",
      "Samarkand",
      "Tashkent",
      "Bukhara",
      "Tashkent",
      "Samarkand",
      "Tashkent",
    ][i],
    size: [100, 70, 100, 90, 50, 100, 125, 100][i],
    remaining: [85, 55, 75, 65, 40, 80, 100, 90][i],
    price: [
      1850000, 2300000, 950000, 1150000, 1600000, 1050000, 1700000, 420000,
    ][i],
    condition: i % 3 === 0 ? "box" : "bottle",
    description: "",
    photos: [],
    status: "active",
    createdAt: Date.now() - i * 3600000,
    demo: true,
  }));
