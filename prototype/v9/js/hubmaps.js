// The hub park: five authored compositions (17 x 17 cells), drawn with the isometric tileset in assets/tiles.
// Generated once from a design script, then kept here as data: edit the grids by hand. One char per cell.
// ground:  .  grass   d  dirt path   D  dark soil   L  leafy grass   p  planks   s  stone   S  stone in water
//          v  water   w  water at the shore   W  low water   r  rock in water   R  rock in low water   b  bush
// props:   o  log   x  log fire   t  stump   k  brown rock   g  grey rock   G  standing stone   f  flowers   h  reeds
// Water, rocks, bushes, logs, fires and stumps block their cell: blobs and animals walk around them.
export const HUBS = {
  stream: {
    title: "Stream",
    text: "A stream crosses the park; plank footbridges carry the paths over it. Meadows on both banks, a fire ring at the crossing.",
    ground: [
      "vwb.b.b.d.b.b.b.b",
      "wvw.....d........",
      "bwww....d.......b",
      "...rww..d........",
      "b...wvw.d.......b",
      ".....wvwd........",
      "b.....wvp.......b",
      ".......wpw.......",
      "dddddddDDpppddddd",
      ".......DDDwvw....",
      "b.......d..wvw..b",
      "........d...rvw..",
      "b.......d....wwww",
      "b.......d......rv",
      "b.......d.......w",
      "........d........",
      "b.b.b.b.d.b.b.b.b"
    ],
    props: [
      "                 ",
      "                 ",
      "              f  ",
      "            f    ",
      "             f f ",
      "             h   ",
      "          o   g  ",
      "                 ",
      "        x        ",
      "           t     ",
      "      o          ",
      "  f              ",
      "   f             ",
      " k   h           ",
      "    f            ",
      "   f             ",
      "                 "
    ]
  },
  glade: {
    title: "Pond glade",
    text: "A clearing with a log fire at the centre, a quiet pond with a stone pier in the far corner, hedges around the rim.",
    ground: [
      "bbbbbbb.d.bbbbbbb",
      "b.......d..wwwbbb",
      "b.......d.wrvvwwb",
      "b.......dwvvvvrwb",
      "b.......dwvvvvvwb",
      "b.......dwvvvvvwb",
      "b......DDDSvvvw.b",
      "......DDDSDwww...",
      "ddddddDDDDDdddddd",
      "......DDDDD......",
      "b......DDD......b",
      "b.......d.......b",
      "b.......d.......b",
      "b.......d.......b",
      "b.......d.......b",
      "b.......d.......b",
      "bbbbbbb.d.bbbbbbb"
    ],
    props: [
      "                 ",
      "                 ",
      "    f            ",
      "   f             ",
      "  f              ",
      "                 ",
      "         o       ",
      "      o          ",
      "        x        ",
      "          o h    ",
      "  k    o         ",
      "              g  ",
      "              f  ",
      "   h         f   ",
      "     f           ",
      "                 ",
      "                 "
    ]
  },
  lake: {
    title: "Lake island",
    text: "The park is a lake with one round island; stone causeways lead in from every bridge. The blobs gather on the island.",
    ground: [
      "WWWWWWWWSWWWWWWWW",
      "WWWWWWvvSvvWrWWWW",
      "WWWWvvvvSvvvvWRWW",
      "WWRvvvwwSwwvvvWWW",
      "WWvvvw.....wvvvWW",
      "WWvvwb.....bwvvWW",
      "Wvvw.........wvrW",
      "Wvvw...DDD...wvvW",
      "SSSS...DDD...SSSS",
      "Wrvw...DDD...wvvW",
      "Wvvw.........wvvW",
      "WWvvwb.....bwvvWW",
      "WWvvvw.....wvvvWW",
      "WWWvvvwwSwwvvvWWW",
      "WWWRvvvvSvvvvRWWW",
      "WWWWWWvvSvvWWWWWW",
      "WWWWWWWWSWWWWWWWW"
    ],
    props: [
      "                 ",
      "                 ",
      "                 ",
      "                 ",
      "                 ",
      "         f       ",
      "      g          ",
      "       o  h      ",
      "     f  x        ",
      "      h  o f     ",
      "                 ",
      "       f         ",
      "                 ",
      "                 ",
      "                 ",
      "                 ",
      "                 "
    ]
  },
  creek: {
    title: "Rocky creek",
    text: "A rocky ridge on the north edge, a creek running off it into a lower pool, a mossy meadow with a log fire.",
    ground: [
      "sssssss.d.sssssss",
      "sssssss.d.sssssss",
      "sssssss.d.sssssss",
      "....ww..d........",
      "b...ww..d.......b",
      "....ww..d........",
      "b...rw..d.......b",
      "....ww..d........",
      "ddddppddddddddddd",
      "..WWWWW.d........",
      "b.WWWWWWd..LLL..b",
      "bWWRWWWWd.LLLLL..",
      "b.WWWWRWd.LLLLL.b",
      "...WWWW.d.LLLLL..",
      "b.......d..LLL..b",
      "........d........",
      "b.b.b.b.d.b.b.b.b"
    ],
    props: [
      "   g         k   ",
      " G    k    G   g ",
      "  k           g  ",
      "                 ",
      "          f      ",
      "  f         f    ",
      "              f  ",
      "                 ",
      "                 ",
      "                 ",
      "                 ",
      "              o  ",
      "            x    ",
      "       f         ",
      " h         o     ",
      "                 ",
      "                 "
    ]
  },
  marsh: {
    title: "Marsh",
    text: "Shallow water everywhere, five grassy islets joined by plank boardwalks, reeds at the water\u2019s edge.",
    ground: [
      "vvvvvvvvpvvvvvvvv",
      "vrvwwwvvpvvvwvvrv",
      "vvw...wvpvvw.wvvv",
      "vw.....wpvw...wvv",
      "vw.....ppp.....wv",
      "vw.....wpww...wvv",
      "vvw...w...ww.wvvv",
      "vvvwpw.....wpvvvv",
      "pppppp.....pppppp",
      "vvvwpw.....wpwvvv",
      "vvw...w...w...wvv",
      "vw.....wpw.....wv",
      "vw.....ppp.....wv",
      "vw.....wpw.....wv",
      "vvw...wvpvw...wvv",
      "vrvwwwvvpvrwwwvrv",
      "vvvvvvvvpvvvvvvvv"
    ],
    props: [
      "                 ",
      "                 ",
      "                 ",
      "    f        h   ",
      "   h             ",
      "     h     hf    ",
      "                 ",
      "         o       ",
      "        t        ",
      "       o         ",
      "                 ",
      "             h   ",
      "   h        x    ",
      "     f     f     ",
      "                 ",
      "                 ",
      "                 "
    ]
  }
};
export const DEFAULT_HUB = 'glade';
// tile numbers for each char; a cell picks one variant from its position, so the same map always looks the same
export const GROUND_TILES = { '.': [40], d: [0, 1, 2, 4, 5, 6, 9], D: [17, 18, 21], L: [27, 28, 29], p: [14, 15, 16], s: [61, 63], S: [66, 69], v: [92, 92, 92, 92, 93, 94, 91], w: [90, 91, 92, 92, 93], W: [101, 101, 101, 102, 103, 100], r: [70, 71, 73, 74], R: [75, 76, 77, 78, 81], b: [30, 31, 32, 33, 34, 35, 36] };
export const PROP_TILES = { o: [48, 50, 51], x: [49], t: [52], k: [53, 54, 55, 56, 57, 58, 59, 60], g: [64, 65, 67], G: [68], f: [41, 42, 44, 46, 47], h: [43, 45] };
export const BLOCKING_GROUND = 'vwWrRb', BLOCKING_PROPS = 'oxtkgG';
