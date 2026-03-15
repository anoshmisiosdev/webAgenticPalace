// Pre-defined demo worlds and missions for cache priming

const DEMO_WORLDS = {
  space_station: {
    description: "Abandoned space station interior. Dark corridors, exposed pipes, emergency lighting. Large central hub with four branching corridors heading north, south, east, west. Debris scattered across floor. Structural damage visible on eastern wall.",
    missions: ["scout for entry points and defensive positions", "find high ground and overwatch positions", "assess threat level and danger zones"]
  },
  jungle_temple: {
    description: "Dense jungle temple ruins at dusk. Moss-covered stone walls, collapsed archways, overgrown pathways. Central courtyard surrounded by four crumbling towers. Vines covering most surfaces. Low visibility due to dense canopy.",
    missions: ["scout for entry points and defensive positions", "find high ground and overwatch positions", "assess threat level and danger zones"]
  },
  cyberpunk_rooftop: {
    description: "Futuristic cyberpunk rooftop at night. Rain-slicked concrete, neon sign reflections, ventilation units and satellite dishes scattered across surface. Two access stairwells visible. Low concrete barriers provide partial cover. City skyline visible in all directions.",
    missions: ["scout for entry points and defensive positions", "find high ground and overwatch positions", "assess threat level and danger zones"]
  }
};

module.exports = { DEMO_WORLDS };
