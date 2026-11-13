/** Shops, stations and their pins compete with game lines, so game maps keep only streets and their names. */
export const QUIET_MAP = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];
