/* Alexander Kim Portfolio: the words and pictures, shared by all three themes.
   Every description is a first draft in Alex's voice (same text as build_portfolio.py),
   so rewrite it here once and all three PDFs pick it up.

   Page fields
     kind     cover | project | feature
     cat      category line            title / sub   poster title + short tagline
     medium   one line for the museum wall label (The Veil)
     desc     [what it is, my role, why I included it]
     figs     { key: {src, alt, note?, fit?: "contain", pos?: object-position} }
     extras   { KEY: {type, ...} }   uppercase keys can be placed in a layout like a picture
     tall     media layout for Bloom + Veil (CSS grid: cols, rows, areas)
     wide     media layout for Opening Night (the stage is wide and short)
     aside    a loose note for the page
*/
const IMG = "../images/";
const MOCK = "../../hearth/mockups/";

const PAGES = [
  /* ------------------------------------------------------------ 01 cover */
  {
    id: "cover", kind: "cover",
    title: "Alexander Kim", sub: "stuff I build, code, draw and design",
    kicker: "OCSA · Production & Design Conservatory",
    figs: {
      a: { src: IMG + "gokart-side.jpg", alt: "The go-kart Alex built at camp" },
      b: { src: IMG + "woven-door.jpg", alt: "The Woven Room: a white gallery with a folded tapestry and shiny sculptures" },
      c: { src: IMG + "cover-stage.jpg", alt: "Alex on stage with the cast of Encanto", pos: "50% 40%" },
      d: { src: IMG + "gk-race.jpg", alt: "The start of a race in Go-Kart World" },
      e: { src: IMG + "lego-mclaren.jpg", alt: "Alex's LEGO McLaren F1 car on the street" },
      f: { src: IMG + "sl63-hero.jpg", alt: "Alex's Mercedes SL63 model in Tinkercad", fit: "contain" },
    },
  },

  /* ------------------------------------------------------------ 02 Hearth */
  {
    id: "hearth", kind: "project", accent: "#D65332",
    cat: "Design & Technology · App design", title: "Hearth", sub: "a wellness app that grows with you",
    medium: "App · designed and coded by directing an Agent coding tool",
    desc: [
      "Hearth is a wellness app built around a daily ritual: each morning it asks “What would make today feel tended?” and you set three small intentions. A quick check-in on your mood, energy and stress shapes kinder goals, an “I’m feeling” page suggests ways to cope, and you get a companion that grows with your streak.",
      "I was the designer and coder: I came up with the idea, designed every screen and feature, and coded it by directing an Agent coding tool for the OC Student AI Network.",
      "Like a lot of students, I juggle assignments, deadlines and social pressure, and I wanted a calm way to take each day one step at a time. I noticed a lot of people make games, so I wanted to make something that stood out and could actually help.",
    ],
    figs: {
      a: { src: MOCK + "combo-keeper.png", alt: "Hearth on a laptop and a phone, showing the little keeper creature in its golden final form", fit: "contain", bare: true },
    },
    extras: { S: { type: "stats", items: [["3", "intentions a day"], ["28", "days to the final form"], ["0", "data collected"]] } },
    aside: "no ads, no tracking!",
    tall: { cols: "1fr", rows: "1fr auto", areas: ["a", "S"] },
    wide: { cols: "1.5fr 1fr", rows: "1fr", areas: ["a S"] },
  },

  /* ------------------------------------------------------------ 03 Hearth colours */
  {
    id: "colors", kind: "feature", accent: "#D65332",
    cat: "Hearth · Color & mood", title: "Colors that match your mood",
    intro: "Colors change how people feel, so I designed four calm themes you can switch between depending on your mood. Each one comes from a place or memory that makes me feel calm.",
    feature: {
      type: "themes", items: [
        { key: "ember", name: "Ember", mood: "cozy + comforting", story: "From camping trips with my mom, where the campfire is one of the most comforting feelings I know.", colors: ["181112", "392522", "F6BE6E", "F26D3D", "D65332", "FDF4E7"] },
        { key: "tidepool", name: "Tidepool", mood: "serene + connected", story: "From exploring tide pools as a kid, where every animal was relaxed and the ecosystem worked as one.", colors: ["0F1820", "1A2A36", "9FD0DE", "7FB3CF", "3A7593", "EAF2F5"] },
        { key: "meadow", name: "Morning Meadow", mood: "fresh + hopeful", story: "From mornings lying in the grass under a blue sky, with nowhere to be and a whole new day ahead.", colors: ["F6F1E7", "FFFCF6", "A0553B", "6E8F62", "56744B", "2F3A33"] },
        { key: "marshy", name: "Marshy", mood: "soft + safe", story: "From Marshy, my sequined midnight-blue sheep, who kept me company on the darkest nights.", colors: ["121838", "1E2652", "A9D4F5", "9CC8F0", "4660B5", "EEF3FC"] },
      ],
    },
  },

  /* ------------------------------------------------------------ 04 Hearth process */
  {
    id: "process", kind: "feature", accent: "#D65332",
    cat: "Hearth · My process", title: "Turning problems into solutions",
    feature: {
      type: "process",
      steps: [
        ["Think", "I sat down and asked myself what tool could make the world better and isn’t out there enough."],
        ["Outline", "I wrote the main outline: a daily check-in, three goals, and a creature that grows."],
        ["Build", "I built it by prompting an Agent coding tool, one feature at a time."],
        ["Test & fix", "I tested each part, and when something broke I found another way."],
      ],
      problems: [
        ["The app wouldn’t load", "My first version wouldn’t run at all.", "I loaded it on a personal account, and it worked.", "Fixed"],
        ["The Agent got stuck on goals", "It kept misreading the goals feature and handing back the same broken answer, no matter how I prompted it.", "I turned the problem into the solution: a goal tracker you set up yourself with short surveys.", "Fixed"],
        ["The shop locks free hats", "The Agent decided you have to buy the free hats for your creature.", "Still working on it, and it’s next on my list.", "In progress"],
      ],
    },
  },

  /* ------------------------------------------------------------ 05 Go-kart build */
  {
    id: "gokart", kind: "project", accent: "#2457C5",
    cat: "Building & Making · Engineering", title: "Go-Kart Build", sub: "Brian’s Skyline, at go-kart scale",
    medium: "Plywood frame, paint, stick shifter",
    desc: [
      "This summer I went to a go-kart camp and built my own kart.",
      "I built the frame, added a stick shifter, and painted it. My favorite car is the Nissan Skyline, so I based the look on Brian’s Skyline from Fast & Furious: silver with blue stripes, plus blue underglow lights to make it more realistic.",
      "It’s the first real vehicle I’ve built, and it’s what inspired my racing game.",
    ],
    figs: {
      a: { src: IMG + "gokart-side.jpg", alt: "The finished go-kart from the side, silver with navy stripes and a stick shifter", note: "the finished kart" },
      b: { src: IMG + "gokart-grt.jpg", alt: "The front of the go-kart, with GTR drawn on the nose", note: "GTR = the car name" },
      c: { src: IMG + "gokart-frame.jpg", alt: "The go-kart from above: the plywood frame and the seat board", note: "1 · the frame" },
      d: { src: IMG + "gokart-paint.jpg", alt: "The painted go-kart with its navy racing stripe", note: "2 · paint + stripes" },
      e: { src: IMG + "gokart-shifter.jpg", alt: "The stick shifter and steering wheel", note: "3 · stick shifter!" },
    },
    extras: { W: { type: "swatches", label: "The Skyline look", items: [["C9CDD2", "Silver body"], ["1F2A4D", "Navy stripes"], ["2F7BFF", "Blue underglow"]] } },
    tall: { cols: "1fr 1fr 1fr .95fr", rows: "1.15fr 1fr", areas: ["a a a b", "c d e b"] },
    wide: { cols: "2fr .75fr .75fr .75fr 1fr", rows: "1fr", areas: ["a c d b e"] },
  },

  /* ------------------------------------------------------------ 06 Crew */
  {
    id: "crew", kind: "feature", accent: "#7A4DD8",
    cat: "Character design · Sketch to 3D", title: "Meet the crew",
    intro: "Jimbob, Srank, Jimmy, Ember and Bernie are five characters I invented and first drew in pen on paper. I turned each sketch into a 3D character, then tried every one in three looks inspired by cartoons and games I studied. I included them to show my process: how a quick doodle grows into a finished character without losing what made the drawing special. They’re the racers in my go-kart game.",
    feature: {
      type: "crew",
      sketch: { src: IMG + "characters-sketches.jpg", alt: "Alex's pen sketches of Jimbob, Srank, Jimmy, Ember and Bernie, with the name Sprout crossed out above Bernie", note: "Bernie was almost named Sprout. It’s still crossed out!" },
      names: ["Jimbob", "Srank", "Jimmy", "Ember", "Bernie"],
      looks: [
        { src: IMG + "crew-toon.png", name: "Toon", tag: "flat + bold" },
        { src: IMG + "crew-galaxy.png", name: "Galaxy", tag: "shiny glow" },
        { src: IMG + "crew-carlo.png", name: "Painted", tag: "fuzzy + wobbly" },
      ],
    },
  },

  /* ------------------------------------------------------------ 07 Go-Kart World */
  {
    id: "gkworld", kind: "project", accent: "#FF2F8E",
    cat: "Coding · Game design", title: "Go-Kart World", sub: "my real kart, now a game",
    medium: "3D racing game · browser + VR headset",
    desc: [
      "I’m really into racing games, so I made a 3D racing game inspired by the go-kart I built and the Crazy Cart I’m customizing.",
      "I drew the characters by hand, then built the game in Visual Studio Code using an agent orchestration harness with the Opus 5.5 model. I added different modes, a drift track and details like sponsor banners inspired by real racing brands, plus Brian’s Skyline turning on a stand in the middle.",
      "It shows how I turn something I built in real life into something people can play.",
    ],
    figs: {
      a: { src: IMG + "gk-race.jpg", alt: "The start of a race in Go-Kart World: Alex's kart on the grid with the crew, the start lights and the sponsor walls", note: "my crew, drawn by hand, on the grid" },
      b: { src: IMG + "gk-skyline.jpg", alt: "Brian's Skyline turning on its stand at night, with blue underglow", note: "Brian’s Skyline" },
      c: { src: IMG + "gk-orbit.jpg", alt: "Alex's kart drifting past the crew, seen from the orbit camera", note: "drifting past the crew" },
    },
    extras: { C: { type: "chips", label: "Modes + features", items: ["Race the crew", "Free drive", "Drift points", "Night", "4 cameras", "VR", "Race HUD"] } },
    tall: { cols: "1fr 1fr", rows: "1.55fr 1fr", areas: ["a a", "b c"] },
    wide: { cols: "1.9fr 1fr 1fr", rows: "1fr", areas: ["a b c"] },
  },

  /* ------------------------------------------------------------ 08 LEGO */
  {
    id: "lego", kind: "project", accent: "#FF7A00",
    cat: "Building & Making → 3D concept", title: "LEGO Virtual Portfolio", sub: "same orange car, now you drive it",
    medium: "LEGO bricks, street-level photography, 3D race circuit",
    desc: [
      "I built two LEGO F1 cars and photographed them outside at street level, so they look like real race cars.",
      "Then I used them to design a virtual portfolio: a LEGO-scale 3D race track where you drive my orange car and pull in to see each project.",
      "It shows how something I built with my hands became the idea for a bigger digital world.",
    ],
    figs: {
      a: { src: IMG + "lego-mclaren.jpg", alt: "Alex's orange LEGO McLaren F1 car shot at street level", note: "I shot them at street level so they look real" },
      b: { src: IMG + "lego-instructions.jpg", alt: "Building from the instruction booklet" },
      c: { src: IMG + "lego-shoot.jpg", alt: "Alex lying on the street photographing his LEGO cars" },
      d: { src: IMG + "lego-pair.jpg", alt: "The red and orange LEGO F1 cars side by side" },
      e: { src: IMG + "gp-brick.jpg", alt: "The brick-built race circuit from above: studded baseplate, brick curbs, displays on brick plinths", note: "the virtual circuit, brick built" },
      f: { src: IMG + "gp-chase.jpg", alt: "Driving the orange LEGO F1 car down the main straight", note: "now you drive it" },
    },
    tall: { cols: "1fr .62fr .62fr", rows: "1fr 1fr 1fr", areas: ["a b c", "d e e", "f e e"] },
    wide: { cols: "1.25fr .6fr .6fr 1.6fr 1.1fr", rows: "1fr 1fr", areas: ["a b c e f", "a d d e f"] },
  },

  /* ------------------------------------------------------------ 09 Wheelie Ride */
  {
    id: "wheelie", kind: "project", accent: "#C8F03C",
    cat: "Coding · Game + real map data", title: "Wheelie Ride", sub: "from one straight road to my real neighborhood",
    medium: "3D game · real OpenStreetMap data",
    desc: [
      "A 3D game where you pick a bike and hold a wheelie as long as you can without looping out. Version 1 was one straight road, so for Version 2 I rebuilt it in my own Orange County neighborhood with real map data.",
      "I designed and built both versions, and I wrote down every problem and fix in a release log.",
      "It shows how I keep improving my projects after version 1.",
    ],
    figs: {
      a: { src: IMG + "wr1.jpg", alt: "Wheelie Ride version 1: a rider on a straight road with pine trees", note: "version 1 · one straight road" },
      b: { src: IMG + "wr2-handdrag.jpg", alt: "Wheelie Ride version 2: a hand drag on the Ninja H2R on Pacific Coast Highway at Anita Street Beach", note: "version 2 · my neighborhood in Orange County" },
      m: { src: IMG + "wr2-map.jpg", alt: "The real map of the area, from OpenStreetMap", note: "click a road to ride there" },
    },
    extras: {
      S: { type: "stats", items: [["15,900", "real roads"], ["104,600", "real buildings"], ["15 × 21 km", "of my real map"]] },
      L: { type: "lessons", label: "What I learned (from my release log)", items: [
        ["Test your data, not just your code.", "The ocean came out as dry land because the elevation data said the sea was 0 m high, same as a beach."],
        ["Faking movement is easy until you want to go somewhere.", "A real position and heading made maps, traffic and landmarks possible."],
        ["Always test the extremes.", "I only found a camera bug by testing the fastest bike."],
      ] },
    },
    tall: { cols: "1.55fr 1fr", rows: ".85fr 1.35fr", areas: ["a S", "b m"] },
    wide: { cols: "1fr 1.5fr .62fr 1.05fr", rows: "1fr", areas: ["a b m L"] },
  },

  /* ------------------------------------------------------------ 10 The Lobby */
  {
    id: "lobby", kind: "project", accent: "#3FE0F0",
    cat: "Coding · 3D / VR concept", title: "The Lobby", sub: "my projects, as game cartridges",
    medium: "3D / VR experience · browser + headset",
    desc: [
      "A 3D game room for all my projects. Each project is a game cartridge you plug into my ALEX-2600 console, then you step through a portal into the game. Bit, a little robot, shows you around.",
      "I sketched this concept to showcase my work, then turned it into a 3D experience you can explore in a browser or a VR headset.",
      "I love the idea of a gaming system that plays the games I’m building, with a virtual robot as your guide.",
    ],
    figs: {
      a: { src: IMG + "lobby-hero.jpg", alt: "The Lobby: a 70s game room with wood walls, a neon sign, the GO-KART cartridge plugged into the ALEX-2600 console under a wood TV, and Bit the robot talking next to a glowing portal", note: "my projects, as game cartridges" },
    },
    extras: { T: { type: "steps", items: [
      [IMG + "lobby-rack.jpg", "Pick a cartridge", "Every project is a cartridge on the rack. The “?” slots are for games I haven’t made yet.", "The cartridge rack with game cartridges and empty question-mark slots"],
      [IMG + "lobby-console.jpg", "Plug it in", "The ALEX-2600 console plays the game’s title screen on the TV.", "WHEELIE SIM plugged into the ALEX-2600 console, with its title screen on the TV"],
      [IMG + "lobby-bit.jpg", "Step through", "Bit tells you about the game, then a portal opens straight into it.", "Bit the robot floating in front of the glowing portal"],
    ] } },
    tall: { cols: "1fr", rows: "1.55fr 1fr", areas: ["a", "T"] },
    wide: { cols: "1.35fr 1fr", rows: "1fr", areas: ["a T"] },
  },

  /* ------------------------------------------------------------ 11 The Woven Room (new) */
  {
    id: "woven", kind: "project", accent: "#C23B2C",
    cat: "VR & Virtual · Exhibit 3", title: "The Woven Room", sub: "solid, but it moves",
    medium: "VR gallery room · browser + headset",
    desc: [
      "A white gallery room you can walk through in a VR headset or a browser. Gunta Stölzl’s 1927/28 Bauhaus tapestry fills the wall, hung in deep folds, with four mirror-shiny sculptures pulled from its shapes.",
      "I flattened a book photo of the tapestry so it could hang as a texture, folded it, added a Metal switch that turns the thread into little tilted metal plates, and shaped the sculptures from its wave, arch, window and diamond patterns.",
      "At The Broad I saw El Anatsui’s wall piece: metal bottle caps that drape like cloth. It was solid, but it looked fluid, and I wanted to bring that into VR, where you can walk right up to it and watch the light move across the folds.",
    ],
    figs: {
      a: { src: IMG + "woven-door.jpg", alt: "The Woven Room from the door: a folded tapestry on the back wall and shiny sculptures on white plinths", note: "from the door" },
      b: { src: IMG + "woven-weave.jpg", alt: "Close-up of the tapestry folds in Metal mode", note: "Metal mode: thread becomes plates" },
      c: { src: IMG + "woven-shine.jpg", alt: "The wave and arch sculptures in mirror finish in front of the tapestry", note: "sculptures pulled from the weave" },
    },
    extras: { R: { type: "next", label: "Next room", title: "The Rose", text: "In my gallery plan, the Rose room comes next: a rose that blooms when you enter the room, inspired by the rose I saw at Dataland.", src: IMG + "notebook-gallery.jpg", alt: "Alex's notebook ground plan of the whole gallery, with the Rose room at the top", note: "my notebook plan" } },
    credit: "Tapestry: Gunta Stölzl, Slit Tapestry Red-Green, 1927/28, from a book photo.",
    tall: { cols: "1fr 1fr .62fr", rows: "1.3fr 1fr", areas: ["a a R", "b c R"] },
    wide: { cols: "1.5fr 1fr 1fr .75fr", rows: "1fr", areas: ["a b c R"] },
  },

  /* ------------------------------------------------------------ 12 Mercedes SL63 */
  {
    id: "sl63", kind: "project", accent: "#F2C200",
    cat: "CAD · 3D modeling", title: "Mercedes SL63", sub: "built from simple shapes",
    medium: "3D model in Tinkercad",
    desc: [
      "This is my 3D model of the Mercedes-AMG SL63, a famous roadster, made in Tinkercad.",
      "I’m a big fan of cars and I like designing in Tinkercad, so I made this as practice and as a 3D model for a game I’m making. I built it from simple shapes, down to the seats, the grille, the wheels and a steering wheel full of buttons.",
      "It shows my sense of scale and design, how I assemble a model from parts, and how I’m learning spatial awareness.",
    ],
    figs: {
      a: { src: IMG + "sl63-hero.jpg", alt: "Three-quarter view of the yellow SL63 model with its two seats and roll bar", fit: "contain", note: "view 1 · three-quarter" },
      b: { src: IMG + "sl63-front.jpg", alt: "Front view showing the grille", fit: "contain", note: "view 2 · front" },
      c: { src: IMG + "sl63-rear.jpg", alt: "Rear three-quarter view with red tail lights and the spoiler", fit: "contain", note: "view 3 · rear" },
      d: { src: IMG + "sl63-side.jpg", alt: "Side view of the long, low roadster", fit: "contain", note: "view 4 · side" },
      e: { src: IMG + "sl63-top.jpg", alt: "Top view of the SL63 model", fit: "contain", note: "view 5 · top" },
      f: { src: IMG + "sl63-dash.jpg", alt: "Close-up of the steering wheel with a screen and colored buttons", note: "even the wheel has buttons!" },
    },
    extras: { B: { type: "titleblock", items: [["Model", "Mercedes-AMG SL63"], ["Tool", "Tinkercad"], ["Drawn by", "Alexander Kim"], ["For", "my racing game"]] } },
    tall: { cols: "1fr 1fr .95fr", rows: "1.25fr .6fr .6fr", areas: ["a a b", "d d c", "e e f"] },
    wide: { cols: "1.5fr 1fr .9fr 1fr", rows: "1fr 1fr", areas: ["a d b f", "a e c f"] },
  },

  /* ------------------------------------------------------------ 13 Poppin' Matcha booth */
  {
    id: "booth", kind: "project", accent: "#5E8C31",
    cat: "Design & Technology · CAD · Real-world spaces", title: "Poppin’ Matcha Booth", sub: "a real space, designed in CAD",
    medium: "CAD booth design for a class company",
    desc: [
      "This is a booth I designed in CAD for Poppin’ Matcha, the company my 7th and 8th grade class ran for Virtual Enterprises Junior Ventures.",
      "I was a Senior Manager in Marketing, responsible for ads and promotions.",
      "It shows how I design real-world environments in CAD, from the back wall and shelves to the lounge chairs and rug.",
    ],
    figs: {
      a: { src: IMG + "booth-plan.jpg", alt: "Plan view of the booth from above: back wall, counter with a screen, pink rug, two lounge chairs and a round table", fit: "contain", note: "plan: back wall, counter + screen, rug, lounge chairs, table" },
      b: { src: IMG + "booth-front.jpg", alt: "Front view of the booth: black curtain wall with a banner, shelves, lounge chairs", fit: "contain", note: "front" },
      c: { src: IMG + "booth-side.jpg", alt: "Side view of the booth with the green side wall", fit: "contain", note: "side" },
    },
    extras: { K: { type: "role", label: "My team role", text: "Senior Manager, Marketing" } },
    tall: { cols: "1.55fr 1fr", rows: "1fr 1fr", areas: ["a b", "a c"] },
    wide: { cols: "1.5fr 1fr 1fr .7fr", rows: "1fr", areas: ["a b c K"] },
  },

  /* ------------------------------------------------------------ 14 Poppin' Matcha ads */
  {
    id: "ads", kind: "project", accent: "#D8648E",
    cat: "Visual art · Graphic design in Canva", title: "Poppin’ Matcha Ads", sub: "a boba with healthy benefits that still keeps its flavor",
    medium: "Canva · web banner, vertical video ad, slides",
    desc: [
      "These are ads and promotions for Poppin’ Matcha: a web banner, a vertical video ad and slides from our marketing plan.",
      "My role was helping create ideas for them. I used Canva, starting with templates and then customizing them for our brand.",
      "It shows graphic design for a brand our class built together as a team.",
    ],
    figs: {
      a: { src: IMG + "ads-banner.jpg", alt: "Web banner: Poppin' Matcha, buy one get one 50% off", fit: "contain", note: "web banner" },
      b: { src: IMG + "ads-plan.jpg", alt: "Marketing plan title slide with the Poppin' Matcha logo", note: "slides from our marketing plan" },
      c: { src: IMG + "ads-what.jpg", alt: "Slide: What is Poppin' Matcha?" },
      d: { src: IMG + "ads-benefits.jpg", alt: "Slide: What are the benefits? Antioxidants, immune system, no added sugars" },
      e: { src: IMG + "ads-video.jpg", alt: "Vertical video ad: the Poppin' Matcha logo over a breaking wave", note: "vertical video ad", phone: true },
    },
    extras: { M: { type: "mission", label: "Our brand mission", text: "a boba with healthy benefits that still keeps its flavor" } },
    tall: { cols: "1fr 1fr .62fr", rows: ".24fr 1fr 1fr", areas: ["a a a", "b c e", "d M e"] },
    wide: { cols: "1fr 1fr 1fr .42fr", rows: ".3fr 1fr", areas: ["a a a e", "b c d e"] },
  },

  /* ------------------------------------------------------------ 15-16 Alex & Mr. Fishy */
  {
    id: "fishy1", kind: "feature", accent: "#F28C1E",
    cat: "Animation · Cartoon series · Storyboards", title: "Alex & Mr. Fishy",
    intro: "Alex & Mr. Fishy is my cartoon series. In every episode, Mr. Fishy gets into a mess and learns something with help from his friend Alex. I picked frames from each cartoon and laid them out as storyboards.",
    aside: "everything will be OK!",
    feature: {
      type: "storyboard", rows: [
        { ep: 1, title: "Freak Out", line: "A storm is coming and Mr. Fishy is scared. His friend Alex comes along and helps him discover he can trust that everything will be OK, and he can ride the waves.", frames: [
          ["fishy-e1-1.jpg", "Title card: a giant wave is coming!", "Episode 1 title card: Mr. Fishy and a crab in front of a giant wave"],
          ["fishy-e1-2.jpg", "Mr. Fishy freaks out about the storm.", "Mr. Fishy looking scared under the sea next to a crab"],
          ["fishy-e1-3.jpg", "With Alex’s help, he rides the waves.", "Mr. Fishy in sunglasses surfing a wave"],
        ] },
        { ep: 2, title: "Wake Up", line: "Mr. Fishy and Alex help a school of fish rebuild their home after they made a mess “messing around.” Brick by brick, they build it back up together.", frames: [
          ["fishy-e2-1.jpg", "Mr. Fishy is fast asleep.", "Mr. Fishy asleep in a blue nightcap, hugging a little purple pet"],
          ["fishy-e2-2.jpg", "His friends need him to wake up.", "A crab and two clownfish next to the sleeping Mr. Fishy"],
          ["fishy-e2-3.jpg", "The fish’s home is a mess of bricks.", "Building bricks floating everywhere while Mr. Fishy, a crab and a clownfish look worried"],
          ["fishy-e2-4.jpg", "Brick by brick, they build it back up together.", "The fish's home rebuilt from bricks, with Mr. Fishy, the crab and the clownfish smiling"],
        ] },
      ],
    },
  },
  {
    id: "fishy2", kind: "feature", accent: "#F28C1E",
    cat: "Alex & Mr. Fishy · Episodes 3 + 4", title: "The Big Race",
    intro: "Rocky Bal Beta was our real pet betta fish. Episode 3 ends with a card in his memory.",
    memorial: { src: IMG + "fishy-memorial.jpg", alt: "The cartoon's ending card: In loving memory of Rocky Bal Beta, with a photo of the real betta fish" },
    feature: {
      type: "storyboard", rows: [
        { ep: 3, title: "Race", line: "Mr. Fishy is sure he’s the best and can win his race without training. He goes up against Rocky Bal Beta, who was our pet betta fish in real life. He loses, and learns that he needs to put the work in and practice humility.", frames: [
          ["fishy-e3-1.jpg", "Mr. Fishy, the “lean mean swimming machine.”", "Mr. Fishy in a headband that says Lean Mean Swimming Machine, with a crab"],
          ["fishy-e3-2.jpg", "His rival: Rocky Bal Beta.", "Rocky Bal Beta, a blue and purple betta fish, in front of red sunburst stripes"],
          ["fishy-e3-3.jpg", "Race day: he falls way behind.", "Mr. Fishy far down the race track while a green dinosaur referee watches"],
          ["fishy-e3-4.jpg", "Time to put the work in.", "Mr. Fishy in sunglasses training on a treadmill called the Fish-O-Matic 3000"],
        ] },
        { ep: 4, title: "Stronger", line: "Mr. Fishy worked hard with Alex to get ready for the race, and he gets a rematch, with a lot of chaos.", frames: [
          ["fishy-e4-1.jpg", "The rematch!", "Rocky Bal Beta and Mr. Fishy on the starting line with the dinosaur referee"],
          ["fishy-e4-2.jpg", "Breaking news: “Banana Pants” interrupts the Tour de Fish.", "A news anchor reporting that a dancing Banana Pants interrupts the Tour de Fish"],
          ["fishy-e4-3.jpg", "A virus makes the computer sick.", "A sick laptop with an ice pack and a thermometer, surrounded by virus germs"],
          ["fishy-e4-4.jpg", "And the chaos keeps coming.", "A crab holding a Go Fish card game box with Mr. Fishy on it, next to the dinosaur"],
        ] },
      ],
    },
  },

  /* ------------------------------------------------------------ 17 The Fort */
  {
    id: "fort", kind: "project", accent: "#B5702D",
    cat: "Building & Making · Woodworking", title: "The Fort", sub: "built with my brother",
    medium: "Wood posts, boards and nails",
    desc: [
      "At a camp I went to with my brother, we built a fort out of wood.",
      "We used posts for the frame, built the first floor above the ground using nails, built the walls, added a roof, and then decorated it. My role was assembling the fort.",
      "It’s where I got my experience building with wood.",
    ],
    figs: {
      a: { src: IMG + "build-fort1-cropped.jpg", alt: "The finished fort standing on its posts, with a roof and a painted wall", note: "posts hold the floor off the ground" },
      b: { src: IMG + "build-fort2.jpg", alt: "Alex and his brother in front of the fort they built, holding their certificates", note: "me + my brother" },
      c: { src: IMG + "build-fort1.jpg", alt: "The fort's decorated front wall", note: "we decorated it!" },
    },
    extras: { P: { type: "build", label: "How we built it", items: [["Posts", "for the frame"], ["Floor", "nailed together, above the ground"], ["Walls", "built and nailed on"], ["Roof", "added on top"], ["Decorate", "made it ours"]] } },
    tall: { cols: ".8fr 1fr", rows: "1fr 1fr auto", areas: ["a b", "a c", "P P"] },
    wide: { cols: ".5fr 1fr 1fr 1.5fr", rows: "1fr", areas: ["a b c P"] },
  },

  /* ------------------------------------------------------------ 18 Birdhouse & glider */
  {
    id: "birdhouse", kind: "project", accent: "#1E9C8A",
    cat: "Building & Making · Early builds", title: "Birdhouse & Glider", sub: "piece by piece",
    medium: "Painted wood birdhouse · balsa-wood glider",
    desc: [
      "Building has always been one of my favorite things to do. These photos show me painting a wooden birdhouse and putting together a balsa-wood glider.",
      "I painted my own design on the birdhouse and assembled the glider piece by piece.",
      "These early projects are where my love of making things started, and they led to bigger builds like my fort and my go-kart.",
    ],
    figs: {
      a: { src: IMG + "build-birdhouse1.jpg", alt: "Alex painting a wooden birdhouse, step 1 of 4", note: "1" },
      b: { src: IMG + "build-birdhouse2.jpg", alt: "Alex painting a wooden birdhouse, step 2 of 4", note: "2" },
      c: { src: IMG + "build-birdhouse3.jpg", alt: "Alex painting a wooden birdhouse, step 3 of 4", note: "3" },
      d: { src: IMG + "build-birdhouse4.jpg", alt: "Alex painting a wooden birdhouse, step 4 of 4", note: "4 · from bare wood to finished" },
      e: { src: IMG + "build-buildplane.jpg", alt: "Alex assembling a balsa-wood glider", note: "the balsa-wood glider" },
    },
    tall: { cols: "1fr 1fr 1.25fr", rows: "1fr 1fr", areas: ["a b e", "c d e"] },
    wide: { cols: "1fr 1fr 1fr 1fr 1.6fr", rows: "1fr", areas: ["a b c d e"] },
  },

  /* ------------------------------------------------------------ 19 Music */
  {
    id: "music", kind: "project", accent: "#8A3FFC",
    cat: "Music · DJ mixing + production", title: "Music Production", sub: "the best part is when everyone starts dancing",
    medium: "MIDI keyboard, laptop, DJ controller",
    desc: [
      "I love playing music. I make and mix music with my MIDI keyboard, my laptop and my DJ controller.",
      "I’ve created my own mixes, performed DJ mixing in my school talent show, and played at parties for my neighborhood.",
      "I like it when people are happy, dancing and enjoying music together.",
    ],
    figs: {
      a: { src: IMG + "music-studio.jpg", alt: "Alex smiling at his desk with his MIDI keyboard, laptop and music software on the monitor", note: "my home studio" },
      b: { src: IMG + "music-dj-2.jpg", alt: "Alex with headphones on, mixing on his DJ controller with the lights on", note: "mixing live" },
      c: { src: IMG + "music-dj-1.jpg", alt: "Alex mixing on his DJ controller, seen from behind" },
      d: { src: IMG + "music-talent-1.jpg", alt: "Alex setting up his DJ table on stage at the talent show", note: "talent show 2026" },
      e: { src: IMG + "music-talent-2.jpg", alt: "Alex DJ mixing on stage under the Got Talent 2026 banner" },
      f: { src: IMG + "music-program.jpg", alt: "The talent show program: 2026 OPA's Got Talent, with DJ Mixing - Alexander Kim circled", note: "my act was on the program!" },
    },
    extras: { C: { type: "chips", label: "Where I’ve played", items: ["Talent show 2026", "Neighborhood parties", "Home studio"] } },
    tall: { cols: "1.35fr .55fr .6fr", rows: "1fr 1fr", areas: ["a b c", "d e f"] },
    wide: { cols: "1.3fr .55fr .6fr 1.3fr 1fr 1.05fr", rows: "1fr", areas: ["a b c d e f"] },
  },

  /* ------------------------------------------------------------ 20 Encanto */
  {
    id: "encanto", kind: "project", accent: "#F5B841",
    cat: "Theatre experience · Performance", title: "Encanto", sub: "next: designing the set!",
    medium: "Youth musical theatre production",
    desc: [
      "Encanto was a youth musical theatre production I performed in, with a big cast, bright costumes and a painted set.",
      "I was part of the cast, singing and acting on stage alongside everyone else to bring the story to life.",
      "Being on stage showed me how much the set, costumes and lighting shape a story, and that’s the side of theatre I want to learn next.",
    ],
    figs: {
      a: { src: IMG + "encanto-hero.jpg", alt: "The full cast of Encanto on stage" },
      b: { src: IMG + "encanto-1.jpg", alt: "Encanto on stage, photo 1" },
      c: { src: IMG + "encanto-2.jpg", alt: "Encanto on stage, photo 2" },
      d: { src: IMG + "encanto-3.jpg", alt: "Encanto on stage, photo 3" },
      e: { src: IMG + "encanto-4.jpg", alt: "Encanto on stage, photo 4" },
    },
    tall: { cols: "1fr 1fr 1fr 1fr", rows: "1.45fr 1fr", areas: ["a a a a", "b c d e"] },
    wide: { cols: "2.4fr .55fr .55fr", rows: "1fr 1fr", areas: ["a b c", "a d e"] },
  },
];

const TOTAL = PAGES.length;
const DESC_LABELS = ["What it is", "My role", "Why I included it"];

/* The table of contents on each cover: page number + name, one line per project. */
const CONTENTS = PAGES.map((p, i) => [i + 1, p]).filter(([, p]) => p.kind !== "cover" && !["colors", "process", "fishy2"].includes(p.id))
  .map(([n, p]) => [n, p.id === "hearth" ? "Hearth (app)" : p.title]);
