export const COUNTRIES = {
  "Barbados": ["Christ Church", "St. Michael", "St. Philip", "St. James", "St. George", "St. John", "St. Andrew", "St. Joseph", "St. Lucy", "St. Peter", "St. Thomas"],
  "Jamaica": ["Kingston", "St. Andrew", "St. Catherine", "Clarendon", "Manchester", "St. Elizabeth", "Westmoreland", "Hanover", "St. James", "Trelawny", "St. Ann", "St. Mary", "Portland", "St. Thomas"],
  "Trinidad & Tobago": ["Trinidad", "Tobago", "Port of Spain", "San Fernando", "Chaguanas", "Arima"],
  "Saint Lucia": ["Castries", "Gros Islet", "Soufrière", "Vieux Fort", "Micoud", "Dennery", "Laborie", "Choiseul", "Anse la Raye", "Canaries"],
  "Bahamas": ["New Providence", "Grand Bahama", "Abaco", "Eleuthera", "Exuma", "Andros", "Bimini", "Long Island", "Cat Island", "Inagua"],
  "Cayman Islands": ["Grand Cayman", "Cayman Brac", "Little Cayman"],
  "Grenada": ["St. George", "St. Andrew", "St. David", "St. John", "St. Mark", "St. Patrick", "Carriacou & Petite Martinique"],
  "Antigua & Barbuda": ["Antigua", "Barbuda", "St. John's", "Redonda"],
  "Dominica": ["St. George", "St. Andrew", "St. David", "St. John", "St. Joseph", "St. Luke", "St. Mark", "St. Patrick", "St. Paul", "St. Peter"],
  "Saint Vincent & the Grenadines": ["Saint Vincent", "Bequia", "Mustique", "Union Island", "Canouan", "Kingstown"],
  "Saint Kitts & Nevis": ["Saint Kitts", "Nevis", "Basseterre", "Charlestown"],
  "Guyana": ["Georgetown", "Demerara-Mahaica", "Essequibo Islands-West Demerara", "East Berbice-Corentyne", "Upper Demerara-Berbice"],
};

export const COUNTRY_NAMES = Object.keys(COUNTRIES);
export const ALL_COUNTRIES = "All Countries";
export const ALL_REGIONS = "All Parishes/Islands";
export const regionsFor = (country) => COUNTRIES[country] || [];

// Back-compat alias (some modules still import ISLANDS)
export const ISLANDS = COUNTRY_NAMES;

export const NAV_LINKS = [
  { to: "/directory", label: "Directory" },
  { to: "/blog", label: "Health Blog" },
  { to: "/events", label: "Events" },
  { to: "/reviews", label: "Reviews" },
];
