export const LOCATION_TYPE_LABELS = {
  kat: "Kat",
  dhome: "Dhomë",
  zyre: "Zyrë",
  zone: "Zonë",
  tjeter: "Tjetër"
};

export const MOVEMENT_LABELS = {
  in: "Hyrje",
  out: "Dalje",
  transfer: "Transferim"
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtMoney = (v) =>
  v == null ? "—" : Number(v).toLocaleString("sq-AL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " L";

export const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("sq-AL"));
