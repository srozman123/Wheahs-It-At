import type { Tag } from "../tags.js";

// Boston photos used when an imported event has no image of its own.
// All from Wikimedia Commons (960px thumbnails, checked to load as image/jpeg, Nov 2026).
// Most are CC BY / CC BY-SA: crediting the author is required, so keep author + page with each URL.
// `tags` is a hint for picking a fitting photo; an empty list means it suits any event.

export type DefaultImage = {
  url: string;
  tags: readonly Tag[];
  author: string;
  license: string;
  page: string; // Commons file page (source + full license)
};

const THUMB = "https://thumb.wikimedia.org/wikipedia/commons/thumb";
const PAGE = "https://commons.wikimedia.org/wiki/File:";

export const DEFAULT_IMAGES: readonly DefaultImage[] = [
  {
    url: `${THUMB}/4/4f/131023-F-PR861-033_Hanscom_participates_in_World_Series_pregame_events.jpg/960px-131023-F-PR861-033_Hanscom_participates_in_World_Series_pregame_events.jpg`,
    tags: ["sports"],
    author: "Rick Berry (U.S. Air Force)",
    license: "Public domain",
    page: `${PAGE}131023-F-PR861-033_Hanscom_participates_in_World_Series_pregame_events.jpg`,
  },
  {
    url: `${THUMB}/0/05/Charles_River_Esplanade_-_IMG_3777.jpg/960px-Charles_River_Esplanade_-_IMG_3777.jpg`,
    tags: ["outdoors", "fitness", "wellness"],
    author: "Daderot",
    license: "Public domain",
    page: `${PAGE}Charles_River_Esplanade_-_IMG_3777.jpg`,
  },
  {
    url: `${THUMB}/4/46/Boston_Common_Lake_April_2025.jpg/960px-Boston_Common_Lake_April_2025.jpg`,
    tags: ["outdoors", "wellness"],
    author: "Gaby Azeem",
    license: "CC0",
    page: `${PAGE}Boston_Common_Lake_April_2025.jpg`,
  },
  {
    url: `${THUMB}/4/44/2017_Harvard_Bridge_from_Memorial_Drive%2C_Cambridge%2C_Massachusetts.jpg/960px-2017_Harvard_Bridge_from_Memorial_Drive%2C_Cambridge%2C_Massachusetts.jpg`,
    tags: ["outdoors", "fitness", "academic"],
    author: "Beyond My Ken",
    license: "CC BY-SA 4.0",
    page: `${PAGE}2017_Harvard_Bridge_from_Memorial_Drive,_Cambridge,_Massachusetts.jpg`,
  },
  {
    url: `${THUMB}/6/69/Aerial_View_Parkman_Bandstand_at_Boston_Common_2.jpg/960px-Aerial_View_Parkman_Bandstand_at_Boston_Common_2.jpg`,
    tags: ["community", "music", "outdoors"],
    author: "AbhiSuryawanshi",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Aerial_View_Parkman_Bandstand_at_Boston_Common_2.jpg`,
  },
  {
    url: `${THUMB}/c/ca/Boston_-_North_End_%2848718567143%29.jpg/960px-Boston_-_North_End_%2848718567143%29.jpg`,
    tags: ["food", "drinks"],
    author: "Ajay Suresh",
    license: "CC BY 2.0",
    page: `${PAGE}Boston_-_North_End_(48718567143).jpg`,
  },
  {
    url: `${THUMB}/2/22/Boston_Chinatown_Paifang.jpg/960px-Boston_Chinatown_Paifang.jpg`,
    tags: ["food", "community"],
    author: "Ingfbruno",
    license: "CC BY-SA 3.0",
    page: `${PAGE}Boston_Chinatown_Paifang.jpg`,
  },
  {
    url: `${THUMB}/8/8b/Quincy_Market_%286226181026%29.jpg/960px-Quincy_Market_%286226181026%29.jpg`,
    tags: ["food", "drinks", "community"],
    author: "Tony Hisgett",
    license: "CC BY 2.0",
    page: `${PAGE}Quincy_Market_(6226181026).jpg`,
  },
  {
    url: `${THUMB}/c/c7/Faneuil_Hall_%285813514354%29.jpg/960px-Faneuil_Hall_%285813514354%29.jpg`,
    tags: ["community", "networking"],
    author: "Eric Kilby",
    license: "CC BY-SA 2.0",
    page: `${PAGE}Faneuil_Hall_(5813514354).jpg`,
  },
  {
    url: `${THUMB}/a/ae/USA-The_Freedom_Trail.JPG/960px-USA-The_Freedom_Trail.JPG`,
    tags: ["community", "outdoors", "volunteering"],
    author: "Ingfbruno",
    license: "CC BY-SA 3.0",
    page: `${PAGE}USA-The_Freedom_Trail.JPG`,
  },
  {
    url: `${THUMB}/0/06/Museum_of_Fine_Arts%2C_Boston_%2854954248311%29.jpg/960px-Museum_of_Fine_Arts%2C_Boston_%2854954248311%29.jpg`,
    tags: ["art", "theater", "film"],
    author: "Ajay Suresh",
    license: "CC BY 4.0",
    page: `${PAGE}Museum_of_Fine_Arts,_Boston_(54954248311).jpg`,
  },
  {
    url: `${THUMB}/9/90/Massachusetts_State_House_Boston_November_2016.jpg/960px-Massachusetts_State_House_Boston_November_2016.jpg`,
    tags: ["academic", "career", "workshop"],
    author: "King of Hearts",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Massachusetts_State_House_Boston_November_2016.jpg`,
  },
  {
    url: `${THUMB}/6/67/Newbury_Street_Boston_May_2018.jpg/960px-Newbury_Street_Boston_May_2018.jpg`,
    tags: ["art", "food", "networking"],
    author: "King of Hearts",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Newbury_Street_Boston_May_2018.jpg`,
  },
  {
    url: `${THUMB}/f/ff/Zakim_Bridge_and_railroad_bridge_Boston_P1010835.jpg/960px-Zakim_Bridge_and_railroad_bridge_Boston_P1010835.jpg`,
    tags: ["nightlife", "tech", "gaming"],
    author: "NewtonCourt",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Zakim_Bridge_and_railroad_bridge_Boston_P1010835.jpg`,
  },
  {
    url: `${THUMB}/c/ca/Boston_skyline_from_Longfellow_Bridge_September_2017_panorama_2.jpg/960px-Boston_skyline_from_Longfellow_Bridge_September_2017_panorama_2.jpg`,
    tags: [],
    author: "King of Hearts",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Boston_skyline_from_Longfellow_Bridge_September_2017_panorama_2.jpg`,
  },
  {
    url: `${THUMB}/c/cf/Longfellow_Bridge%2C_November_2019.jpg/960px-Longfellow_Bridge%2C_November_2019.jpg`,
    tags: [],
    author: "Another Believer",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Longfellow_Bridge,_November_2019.jpg`,
  },
  {
    url: `${THUMB}/d/df/Fort_Independence_on_Castle_Island.JPG/960px-Fort_Independence_on_Castle_Island.JPG`,
    tags: ["outdoors"],
    author: "Chris Wood",
    license: "CC BY-SA 4.0",
    page: `${PAGE}Fort_Independence_on_Castle_Island.JPG`,
  },
];
