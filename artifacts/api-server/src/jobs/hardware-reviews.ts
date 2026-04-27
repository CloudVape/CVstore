import { db, postsTable, usersTable, categoriesTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const HARDWARE_CATEGORY_SLUG = "hardware-reviews";
const SOURCE_PREFIX = "ai-review:";
const MIN_GAP_DAYS = 2;
const MAX_GAP_DAYS = 3;
const BACKFILL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

type ReviewSeed = {
  slug: string;
  title: string;
  content: string;
  tags: string[];
};

const REVIEW_POOL: ReviewSeed[] = [
  {
    slug: "voopoo-drag-x2",
    title: "VOOPOO Drag X2 — A Month In",
    content:
      "Picked this up on a whim and it's quietly become my daily.\n\nThe GENE.AI 3.0 chip is genuinely smart — it learns your wattage habits over a few sessions and the curve smooths out. Build is solid, slightly chunky in the hand but the leather inlay is a nice touch.\n\n**Pros:** Battery life is excellent on a single 21700, PnP coil compatibility is huge, fires fast.\n**Cons:** USB-C port location is awkward when standing it up, and the menu navigation takes a minute to learn.\n\n7.5/10 — not flashy but it just works.",
    tags: ["voopoo", "drag-x2", "single-battery", "pod-mod"],
  },
  {
    slug: "vaporesso-xros-4",
    title: "Vaporesso XROS 4 vs XROS 3 — Worth the Upgrade?",
    content:
      "Short answer: only if you hated the XROS 3's airflow.\n\nThe new adjustable AFC ring is the headline feature and it actually works well — six clear settings from MTL tight to loose RDL. Battery bumped to 1000mAh which gets me through a full day.\n\nFlavour from the new 0.4Ω mesh coil is noticeably crisper at low watts. The 0.6Ω Restricted DTL is the one to grab if you want something between MTL and DTL.\n\nIf you have an XROS 3 and it's working — skip it. If you're new or your old one's dying, this is the best refillable pod under £30.",
    tags: ["vaporesso", "xros", "pod", "mtl"],
  },
  {
    slug: "uwell-caliburn-g3",
    title: "Uwell Caliburn G3 — Still the Pod King?",
    content:
      "I've used every Caliburn since the original and the G3 is the most polished yet.\n\n900mAh battery, USB-C, and the new pod design with the meshed Pro 2 coil give it noticeable improvements over the G2. Flavour at 25W is better than any pod system in this size class.\n\n**The good:** Top-airflow, no leaks in three weeks, beautiful colour finish.\n**The not-so-good:** Pods still cost a fortune long-term, and the button-fire toggle is fiddly.\n\nIf you want a no-nonsense pod that just works, this is it.",
    tags: ["uwell", "caliburn", "pod", "beginner-friendly"],
  },
  {
    slug: "lost-vape-thelema-quest-200w",
    title: "Lost Vape Thelema Quest 200W — Underrated Workhorse",
    content:
      "The Thelema Quest doesn't get the love it deserves.\n\nQuest chip is fast, the screen is clear (no fancy graphics, just info), and the build is genuinely premium — calf leather, zinc alloy frame, real heft. Pulls 200W from dual 18650s without breaking a sweat.\n\nNo Bluetooth, no apps, no gimmicks. Just a regulated mod that fires every time. If you pair it with a UB Pro tank or RTA, you've got a setup that'll last years.\n\nQuiet 9/10 — overshadowed by louder brands, deserves a spot on more shelves.",
    tags: ["lost-vape", "thelema", "dna-alternative", "dual-battery"],
  },
  {
    slug: "geekvape-z-max-tank",
    title: "Geekvape Z Max Subohm Tank — Mesh Done Right",
    content:
      "A tank review for once instead of a mod.\n\nThe Z Max takes the entire Z coil family — that's a huge ecosystem of options. I've been running the Z0.15Ω Mesh head at 80W and the flavour is genuinely premium. Top airflow eliminates the leaking issues older Z tanks had.\n\n4ml standard glass, 6ml bubble glass included. Top fill is smooth, no spillback when capping.\n\nIf you're rocking an Aegis or any 80W+ mod and want a hassle-free tank, this is a no-brainer at the price.",
    tags: ["geekvape", "z-max", "subohm-tank", "mesh"],
  },
  {
    slug: "innokin-coolfire-z80",
    title: "Innokin CoolFire Z80 — Forgotten Gem",
    content:
      "Innokin doesn't shout about their stuff and that's why this got missed.\n\nSingle 21700, 80W, AETHON chip. The form factor is genuinely small — fits in a jeans pocket without bulging. Pairs perfectly with the Zenith II tank.\n\nNo bells and whistles. Power mode, voltage mode, that's it. The fire button has a satisfying click and the contacts feel solid.\n\n8/10. If you want a clean MTL or restricted DTL setup that won't embarrass you in front of company, here you go.",
    tags: ["innokin", "coolfire", "mtl", "single-battery"],
  },
  {
    slug: "hellvape-dead-rabbit-3",
    title: "Hellvape Dead Rabbit 3 RDA — Is It Still The Build King?",
    content:
      "Three generations in and the Dead Rabbit RDA is still the benchmark.\n\nThe new postless deck is the best change — easier builds, cleaner wicking. Side and bottom airflow give you flexibility from restricted to wide-open. Squonk pin included, top cap rotation is smooth.\n\nDual coils at 0.18Ω with fused claptons, juicing onto Cotton Bacon — clouds and flavour both. I get a solid 30+ pulls per drip on the squonk version.\n\nFor £25-30, you're not finding a better dual-coil dripper. 9/10.",
    tags: ["hellvape", "dead-rabbit", "rda", "build-deck"],
  },
  {
    slug: "wotofo-profile-x",
    title: "Wotofo Profile X RTA — Mesh Done Properly",
    content:
      "I held off on mesh RTAs for years. The Profile X converted me.\n\nThe deck takes mesh strips OR coils, which is rare and welcome. Flavour from a Wotofo nexMESH 0.15Ω strip rivals a good RDA — that's not a small claim.\n\nWicking is forgiving but you have to leave just enough cotton. Too tight = dry hits, too loose = leaks. There's a learning curve.\n\n5ml capacity, top airflow, no leaks once dialed in. 8.5/10 for mesh fans, 7/10 if you prefer traditional coil RTAs.",
    tags: ["wotofo", "profile-x", "rta", "mesh"],
  },
  {
    slug: "smok-rpm-100",
    title: "SMOK RPM 100 — A Better SMOK Than Usual",
    content:
      "I've been hard on SMOK in the past for shoddy QC. The RPM 100 surprised me.\n\nIt's a single 18650 or 21700 pod-mod hybrid using the popular RPM 3 coil family. Build quality is noticeably better than the Nord series — the panels don't rattle, the firing button has actual feedback.\n\nBattery life is decent on a 21700. The IQS chip is responsive. Where SMOK still falls short is the menu — it's busy and the icons are tiny.\n\nWorth picking up if you're already invested in RPM coils. 7.5/10.",
    tags: ["smok", "rpm-100", "pod-mod", "single-battery"],
  },
  {
    slug: "asmodus-minikin-3-200w",
    title: "AsMODus Minikin 3 200W — The Cult Classic Returns",
    content:
      "The Minikin name means something to old-school vapers. The 3 mostly lives up to it.\n\nSame ergonomic shape as the original — fits the hand like a glove. The 200W output is genuine, the touchscreen is responsive, and the GX-200 chip handles temp control well.\n\nMy gripes: the touchscreen attracts fingerprints like crazy, and the price is steep compared to mass-market mods with similar specs.\n\nIf you remember the original Minikin fondly, this is for you. 8/10 nostalgic, 7/10 objectively.",
    tags: ["asmodus", "minikin", "touchscreen", "dual-battery"],
  },
  {
    slug: "oxva-xlim-pro-2",
    title: "OXVA Xlim Pro 2 — The Caliburn G3 Killer?",
    content:
      "I've been daily-driving both for the comparison.\n\nThe Xlim Pro 2 has a slight edge on flavour with the new top airflow design and the 0.6Ω mesh coil. Battery is 1000mAh — same as G3. Build is plastic but doesn't feel cheap.\n\nWhere it wins: pods are noticeably cheaper than Caliburn pods.\nWhere it loses: the airflow control is less granular than G3's.\n\nIt's not a killer — it's a credible alternative. If price-per-pod matters, choose Xlim. 8/10.",
    tags: ["oxva", "xlim", "pod", "comparison"],
  },
  {
    slug: "geekvape-aegis-x2-200w",
    title: "Geekvape Aegis X2 200W — IP68 Tank Mod Refresh",
    content:
      "The X has always been the chunky-tough Aegis. The X2 trims a few millimetres without losing toughness.\n\nIP68 still rated, 1.5m drop tested, screen is now larger and brighter. Boost Pro chip is the same as the Legend 3 — fast, responsive. Dual 18650s give a solid day of heavy use.\n\nIf you work outdoors, on a building site, or you're just clumsy — this is the mod. The new Z Max tank pairs perfectly with it.\n\n9/10 for ruggedness, 8.5/10 overall.",
    tags: ["geekvape", "aegis-x2", "rugged", "ip68"],
  },
  {
    slug: "dovpo-mvp-220w",
    title: "Dovpo MVP 220W — Co-Op Mod Worth It?",
    content:
      "Dovpo's collab with Vaping Bogan and AmbitionZ Vaper.\n\nThe controls are genuinely thoughtful — physical adjustment wheel like a DNA mod, but cheaper. 220W output, dual 18650s, sensible menu, no junk modes.\n\nFinish quality is excellent. The painted version held up well after a month in my pocket with keys.\n\nWhere it stumbles: temp control is mediocre compared to a real DNA. But for power vapers it's a 9/10. Easily my favourite collab mod of the year.",
    tags: ["dovpo", "mvp", "collab", "dual-battery"],
  },
  {
    slug: "vandyvape-pulse-aio-v2",
    title: "Vandy Vape Pulse AIO V2 — Squonker For The Modern Era",
    content:
      "The original Pulse AIO was great. V2 is an evolution, not a revolution.\n\nNow takes a 21700 instead of 18650 — battery life jumped significantly. The 510 connection accepts most RDAs up to 24mm, and the squonk bottle is now 6ml.\n\nBuild deck is fiddly but rewards patience. With a single fused clapton at 0.4Ω I'm getting incredible flavour at 35W.\n\nIt's not a beginner device. But for someone who wants a portable squonk RDA experience without the bulk of a regulated mod + RDA, this is the move. 9/10 for the right user.",
    tags: ["vandy-vape", "pulse-aio", "squonker", "rda"],
  },
  {
    slug: "freemax-marvos-x-pro",
    title: "Freemax Marvos X Pro 100W — Underdog Subohm Pod",
    content:
      "Freemax tanks have been quietly excellent for years. The Marvos X Pro pod-mod system continues that.\n\nUses the existing MS-coil family. The 0.15Ω TX-1 mesh at 80W produces flavour that punches above its £40 price point. Pods hold 5ml and the magnetic connection is sturdy.\n\nBattery on a single 21700 lasts a full day even at high wattage. Charging via Type-C is fast.\n\n8/10 — Freemax keeps making good kit and not enough people notice.",
    tags: ["freemax", "marvos", "pod-mod", "subohm"],
  },
  {
    slug: "hellvape-fat-rabbit-2",
    title: "Hellvape Fat Rabbit 2 Subohm — Worth Replacing the Original?",
    content:
      "The original Fat Rabbit was a tank that punched above its weight. The 2 doubles down.\n\nNew coil family — F2-series. The F2 0.15Ω mesh at 80W gives crisp, dense flavour with no muting. Top airflow has been refined and there's zero leaking.\n\nGlass capacity is 5ml standard, 6.5ml with the bubble glass. Top fill is silicone-stoppered — easy and clean.\n\nIf you have the original Fat Rabbit and the coils are getting harder to find, this is the natural next step. 8.5/10.",
    tags: ["hellvape", "fat-rabbit", "subohm-tank", "mesh"],
  },
  {
    slug: "thunderhead-creations-tauren-x",
    title: "Thunderhead Creations Tauren X — Squonk Mech Done Sensibly",
    content:
      "Mech mods scare a lot of people. The Tauren X is one I'd recommend to a confident beginner.\n\nIt's a hybrid mech but built around safety: short-circuit protection via the included safety locking ring, 21700 battery, sensible squonk bottle.\n\nPaired with an unregulated RDA (I run a Citadel) the hits are punchy and immediate. Voltage drop is minimal.\n\nKnow your ohm's law before buying. With that out of the way: 8/10. Quality build, fair price, sensible safety features.",
    tags: ["thunderhead", "tauren-x", "mech-mod", "squonker"],
  },
  {
    slug: "smok-arcfox",
    title: "SMOK Arcfox 230W — Touchscreen Fashion Or Function?",
    content:
      "SMOK keeps trying touchscreens. The Arcfox is the most polished attempt yet.\n\nBig 1.9-inch touchscreen, 230W from dual 18650s, IQ-AX chip. The screen is responsive but I still found myself wishing for buttons after a week — touch on a vape mod is a solution looking for a problem.\n\nFlavour fires fast, build is solid, screen wakes on motion. Pairs with TFV Mini V2 tank well.\n\n7/10 — gimmicky but not bad. If you don't want a touchscreen, get the Morph 3 instead.",
    tags: ["smok", "arcfox", "touchscreen", "dual-battery"],
  },
  {
    slug: "augvape-druga-foxy",
    title: "Augvape Druga Foxy 21700 — Squonk Mech For Veterans",
    content:
      "Augvape Druga line keeps getting refined. The Foxy is the cleanest yet.\n\nFloating 510, magnetic battery door, threaded 21700 contact for low voltage drop. The squonk bottle is silicone — easy to refill, no cracking.\n\nMech, so know your safety. Paired with a Druga RDA at 0.25Ω this thing rips.\n\nBuild quality is exceptional for the price. Magnets are strong without being annoying. 9/10 for veteran mech users — beginners look elsewhere.",
    tags: ["augvape", "druga", "foxy", "mech-mod"],
  },
  {
    slug: "vaporesso-armour-max",
    title: "Vaporesso Armour Max — Direct Competitor to the Aegis",
    content:
      "Vaporesso took aim at Geekvape's Aegis line and the Armour Max is the result.\n\nIP67 (one short of the Aegis's IP68), TPU casing, AXON chip with 220W output from dual 21700s. The TPU casing is genuinely tougher than I expected — survived a drop onto concrete.\n\nMenu is cleaner than Geekvape's, screen is sharper, fires noticeably snappier.\n\nIs it better than the Aegis X2? Closer than I expected. 8.5/10 — finally a real challenger.",
    tags: ["vaporesso", "armour-max", "rugged", "dual-21700"],
  },
  {
    slug: "wismec-reuleaux-rx-mini",
    title: "Wismec Reuleaux RX Mini — Nostalgia Or Useful?",
    content:
      "Wismec brought back the RX line. Cynic in me thought: cash grab. Then I used it.\n\nIt's a single 18650, 80W, classic Reuleaux ergonomics. The chip is updated with proper temp control modes. The screen is monochrome OLED — old-school, readable in sunlight.\n\nFor an everyday simple mod, this hits the spot. Won't replace your flagship but as a backup or stealth carry: 8/10.",
    tags: ["wismec", "reuleaux", "single-battery", "classic"],
  },
  {
    slug: "ehpro-cold-steel-200",
    title: "Ehpro Cold Steel 200 — TC Done Right",
    content:
      "Temp control is a feature most mods get half right. Ehpro nailed it.\n\nThe cold steel chip handles SS316, Ti, Ni200 with separate TCR profiles. The curve is smooth — no ramp spikes, no cooldown lag. If you're a TC user this is genuinely better than 90% of mainstream mods.\n\nBuild is austere, almost industrial. Not pretty but solid. Single 21700.\n\n9/10 for TC enthusiasts, 7/10 for power vapers (it does power fine, but you're not using its strengths).",
    tags: ["ehpro", "cold-steel", "temp-control", "single-21700"],
  },
  {
    slug: "vaperz-cloud-gaur-21",
    title: "Vaperz Cloud Gaur-21 — High-End Squonker Worth The Money?",
    content:
      "Vaperz Cloud sits in that boutique tier. The Gaur-21 is one of their flagships.\n\nMachined zirconium chassis, 21700, gold-plated 510, gold-plated squonk pin, BB-style juice well. Everything is overbuilt.\n\nIs it worth the £200+? If you appreciate machined builds, yes. If you just want function, get a Pulse AIO V2 for a third of the price.\n\nFor what it is: 9/10. For the average vaper: hold off.",
    tags: ["vaperz-cloud", "gaur", "high-end", "squonker"],
  },
  {
    slug: "joyetech-evio-grip",
    title: "Joyetech eVio Grip — A Pod For Heavy Vapers",
    content:
      "Joyetech still makes pods and the eVio Grip is one of the best.\n\nBuilt-in 1000mAh, side-fill, takes the EZ coil family. The 0.4Ω at 25W is the sweet spot. Battery lasts an honest day of moderate use.\n\nHas a ceramic-coated mouthpiece which sounds gimmicky but actually feels nicer than plastic.\n\nBeginner-friendly, decent flavour, fair price. 8/10. Not exciting but easy to recommend.",
    tags: ["joyetech", "evio-grip", "pod", "beginner-friendly"],
  },
  {
    slug: "yihi-sxmini-sl-pro-class",
    title: "YiHi SXmini SL Pro Class — DNA Killer?",
    content:
      "YiHi chips have always been the closest competitor to Evolv's DNA. The SL Pro is the strongest yet.\n\nSXi-Q chip with proper temp control, dual 18650, classic SXmini joystick navigation (love it or hate it). The screen is small but the menus are well-designed.\n\nFlavour through the curve is exceptional — it really does compete with DNA boards.\n\nNot cheap. But for a chip-snob who wants something other than DNA: 9/10.",
    tags: ["yihi", "sxmini", "high-end", "temp-control"],
  },
  {
    slug: "vandyvape-mato-rdta",
    title: "Vandy Vape Mato RDTA — Best of Both Worlds?",
    content:
      "RDTAs sit awkwardly between RDAs and RTAs. The Mato makes the format work.\n\n5ml juice well, side airflow direct to the deck, postless build deck. Wicking is surprisingly forgiving — drop the cotton tails into the well and you're done.\n\nSingle or dual coil capable. With a single fused clapton at 0.3Ω the flavour is RDA-level with the convenience of a tank.\n\n8.5/10 — if you've been on the fence about RDTAs, start here.",
    tags: ["vandy-vape", "mato", "rdta", "build-deck"],
  },
  {
    slug: "ijoy-captain-x-3-200w",
    title: "IJOY Captain X3 200W — Comeback Mod From IJOY",
    content:
      "IJOY went quiet for a while. The Captain X3 is their comeback.\n\nDual 18650, 200W, basic but fast chip. The body shape is comfortable, build feels solid (improved from old IJOY QC issues), screen is clear.\n\nNo gimmicks, no app, no Bluetooth. Power, voltage, TC modes. Done.\n\n7.5/10 — competent return. Not pushing the envelope but if you want a no-nonsense workhorse, it's worth a look.",
    tags: ["ijoy", "captain", "dual-battery", "workhorse"],
  },
  {
    slug: "uwell-crown-5-tank",
    title: "Uwell Crown 5 Tank — King of Subohm Tanks Returns",
    content:
      "The Crown name has been carried by every iteration since the original. Crown 5 lives up to it.\n\nNew UN2 coil family, top airflow refined from the Crown 4, 5ml capacity. Self-cleaning tech that supposedly extends coil life — in my testing it does add about 30% to coil lifespan.\n\nFlavour at 80W on the 0.23Ω mesh is up there with anything from Geekvape or Freemax.\n\n9/10 — Uwell knows tanks. This is the proof.",
    tags: ["uwell", "crown-5", "subohm-tank", "mesh"],
  },
  {
    slug: "geekvape-h45-pulse",
    title: "Geekvape H45 Pulse — Pod-Mod Hybrid Done Lean",
    content:
      "Geekvape's pod-mod attempts have been hit-or-miss. The H45 is a hit.\n\nSingle 18650 or built-in 1400mAh option, 45W max, takes the universal G-coil family that Aegis pods also use.\n\nThe build is genuinely premium — leatherette panels, metal frame, tactile button. Screen is small but readable.\n\nNot for cloud chasers. For someone who wants a quality MTL or restricted DTL setup: 9/10.",
    tags: ["geekvape", "h45-pulse", "pod-mod", "mtl"],
  },
  {
    slug: "voopoo-argus-pro-2",
    title: "VOOPOO Argus Pro 2 — Refining a Winner",
    content:
      "The original Argus Pro was a top-tier 80W single-cell mod. The Pro 2 adds polish without breaking what worked.\n\nGENE.TT 2.0 chip, single 21700, leatherette finish. Screen is now larger with a brighter backlight. The PnP-X coil family compatibility is the same — huge ecosystem.\n\nBattery life is honestly excellent. I get 1.5 days of moderate use.\n\nIf you've never owned an Argus Pro: 9/10. If you have the original: 7/10 upgrade — it's better but not dramatically.",
    tags: ["voopoo", "argus-pro", "single-21700", "pod-mod"],
  },
  {
    slug: "nevoks-feelin-x",
    title: "Nevoks Feelin X — Boutique Pod Worth Looking At",
    content:
      "Nevoks isn't a household name. The Feelin X might change that.\n\n1100mAh battery, 25W max, takes their proprietary X-coil family. The ceramic 0.6Ω is excellent for nic salts at 15W.\n\nWhere it stands out: the magnetic pod connection is the most secure I've used on a pod system. No wobble, no juice creep.\n\n8/10 — boutique vibe, mainstream usability. Worth a punt if you want something different.",
    tags: ["nevoks", "feelin-x", "pod", "ceramic-coil"],
  },
  {
    slug: "lost-vape-ursa-baby-2",
    title: "Lost Vape Ursa Baby 2 — Pocket Powerhouse",
    content:
      "The Ursa Baby was already small. The Baby 2 is somehow smaller and better.\n\n900mAh battery, USB-C, takes the UB-Pro coil family which has options from MTL all the way to RDL. The 0.3Ω at 25W is my preferred config.\n\nThe finish is real Italian leather — this thing feels like a £100 device, not a £25 one.\n\nBattery life is decent given the size. 9/10 for stealth carry.",
    tags: ["lost-vape", "ursa-baby", "pod", "stealth"],
  },
  {
    slug: "voopoo-vmate-max",
    title: "VOOPOO VMate Max Pod Mod — Big Pod Energy",
    content:
      "Pod systems have crept up in size. The VMate Max embraces it.\n\n3000mAh built-in battery, takes the VMate Pro pods (5ml capacity), 80W max output. This sits between a pod and a small mod.\n\nFlavour from the new mesh 0.15Ω at 65W is dense and crisp. Battery genuinely lasts two days for me.\n\nDownside: it's bulky. Not pocket-friendly.\n\n8/10 if size doesn't matter to you, 6/10 if it does.",
    tags: ["voopoo", "vmate-max", "pod-mod", "high-capacity"],
  },
  {
    slug: "drag-h80-vs-aegis-mini-2",
    title: "VOOPOO Drag H80 vs Geekvape Aegis Mini 2 — Single Battery Showdown",
    content:
      "Two of the most popular single-18650 mods on the market. I've used both for two weeks each.\n\n**Power:** Drag H80 hits hard out of the gate, Aegis Mini 2 ramps slightly slower but more linearly. Personal preference.\n**Build:** Aegis Mini 2 wins — IP68 vs the Drag's standard build.\n**Coils:** Drag uses PnP-X (huge ecosystem). Aegis uses Z-coils via the included tank — also huge.\n**Battery life:** Tied.\n\n**Verdict:** Aegis Mini 2 if you're rough on gear. Drag H80 if you're settled and want pure performance. Both 8.5/10.",
    tags: ["voopoo", "geekvape", "comparison", "single-battery"],
  },
  {
    slug: "augvape-merlin-mtl-pro",
    title: "Augvape Merlin MTL Pro RTA — MTL Done Right",
    content:
      "MTL RTAs are a niche within a niche. The Merlin MTL Pro nails the niche.\n\n2ml or 4ml extension capacity, single coil deck designed specifically for tight builds, six precision airflow inserts from very tight to medium-tight.\n\nBuilt with a 28-gauge Kanthal at 1.2Ω — genuinely cigarette-like draw with proper flavour. Wicking is fiddly but rewards patience.\n\nNot for beginners. For MTL purists: 9.5/10.",
    tags: ["augvape", "merlin", "mtl-rta", "single-coil"],
  },
  {
    slug: "oxva-velocity-le-mod",
    title: "OXVA Velocity LE Mod — DNA Chip On A Budget?",
    content:
      "OXVA's Velocity LE uses an in-house chip that mimics DNA-style smoothness at a fraction of the price.\n\nDual 18650, 100W, screen is monochrome OLED, button placement is comfortable. The chip's curve is genuinely smoother than typical mass-market chips — not quite DNA, but closer than the price suggests.\n\nBuild quality has been a concern for OXVA in the past. The LE feels noticeably more solid than older Velocity models.\n\n8.5/10 — quietly one of the best value mods this year.",
    tags: ["oxva", "velocity-le", "dual-battery", "value"],
  },
];

function gapDaysAt(index: number): number {
  const range = MAX_GAP_DAYS - MIN_GAP_DAYS + 1;
  return MIN_GAP_DAYS + (index % range);
}

function withNoonAndJitter(d: Date, salt: number): Date {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
  const offsetMin = ((salt * 37) % 480) - 240;
  return new Date(base.getTime() + offsetMin * 60 * 1000);
}

async function getHardwareCategoryId(): Promise<number | null> {
  const rows = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, HARDWARE_CATEGORY_SLUG))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function getReviewPersonaIds(): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.isAiPersona, true))
    .orderBy(usersTable.id);
  return rows.map((r) => r.id);
}

async function getUsedReviewSlugs(): Promise<Set<string>> {
  const rows = await db
    .select({ sourceUrl: postsTable.sourceUrl })
    .from(postsTable)
    .where(sql`${postsTable.sourceUrl} LIKE ${SOURCE_PREFIX + "%"}`);
  return new Set(rows.map((r) => r.sourceUrl?.slice(SOURCE_PREFIX.length) ?? ""));
}

async function getLastReviewDate(categoryId: number): Promise<Date | null> {
  const rows = await db
    .select({ createdAt: postsTable.createdAt })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.categoryId, categoryId),
        sql`${postsTable.sourceUrl} LIKE ${SOURCE_PREFIX + "%"}`,
      ),
    )
    .orderBy(desc(postsTable.createdAt))
    .limit(1);
  return rows[0]?.createdAt ?? null;
}

function nextReview(used: Set<string>): ReviewSeed | null {
  for (const review of REVIEW_POOL) {
    if (!used.has(review.slug)) return review;
  }
  return null;
}

function imageUrlForSlug(slug: string): string {
  return `/images/hardware-reviews/${slug}.jpg`;
}

async function insertReview(
  review: ReviewSeed,
  categoryId: number,
  authorId: number,
  createdAt: Date,
): Promise<void> {
  const at = withNoonAndJitter(createdAt, authorId);
  await db.insert(postsTable).values({
    title: review.title,
    content: review.content,
    categoryId,
    authorId,
    isAiGenerated: true,
    tags: review.tags,
    sourceUrl: SOURCE_PREFIX + review.slug,
    imageUrl: imageUrlForSlug(review.slug),
    createdAt: at,
    updatedAt: at,
  });
  await db
    .update(usersTable)
    .set({ postCount: sql`${usersTable.postCount} + 1` })
    .where(eq(usersTable.id, authorId));
  await db
    .update(categoriesTable)
    .set({ postCount: sql`${categoriesTable.postCount} + 1` })
    .where(eq(categoriesTable.id, categoryId));
}

async function ensureHardwareReviews(): Promise<void> {
  const categoryId = await getHardwareCategoryId();
  if (!categoryId) {
    logger.warn("Hardware reviews category not found; review job idle.");
    return;
  }
  const personas = await getReviewPersonaIds();
  if (personas.length === 0) {
    logger.warn("No AI personas; review job idle.");
    return;
  }

  const used = await getUsedReviewSlugs();
  const last = await getLastReviewDate(categoryId);
  const now = new Date();
  let personaCursor = used.size % personas.length;
  let inserted = 0;
  let exhausted = false;

  // Compute the schedule: list of timestamps where a review should exist.
  // Gaps alternate between MIN_GAP_DAYS and MAX_GAP_DAYS as the index advances.
  const schedule: Date[] = [];
  if (!last) {
    // Fresh install: lay down a sparse history at 2-3 day intervals.
    let when = new Date(now.getTime() - BACKFILL_DAYS * DAY_MS);
    let i = 0;
    while (when.getTime() <= now.getTime()) {
      schedule.push(when);
      when = new Date(when.getTime() + gapDaysAt(i) * DAY_MS);
      i++;
    }
  } else {
    // Catch up from the last existing review onward.
    let cursor = new Date(last);
    let i = used.size;
    while (true) {
      const next = new Date(cursor.getTime() + gapDaysAt(i) * DAY_MS);
      if (next.getTime() > now.getTime()) break;
      schedule.push(next);
      cursor = next;
      i++;
    }
  }

  for (const when of schedule) {
    const review = nextReview(used);
    if (!review) {
      exhausted = true;
      break;
    }
    const author = personas[personaCursor % personas.length]!;
    personaCursor++;
    try {
      await insertReview(review, categoryId, author, when);
      used.add(review.slug);
      inserted++;
    } catch (err) {
      logger.error({ err, slug: review.slug }, "Failed to insert hardware review");
    }
  }

  if (inserted > 0) {
    logger.info({ inserted, gapDays: `${MIN_GAP_DAYS}-${MAX_GAP_DAYS}` }, "Hardware review job inserted posts");
  }
  if (exhausted) {
    logger.warn("Hardware review pool exhausted; consider expanding REVIEW_POOL.");
  }

  await backfillReviewImages();
}

async function backfillReviewImages(): Promise<void> {
  const rows = await db
    .select({ id: postsTable.id, sourceUrl: postsTable.sourceUrl, imageUrl: postsTable.imageUrl })
    .from(postsTable)
    .where(sql`${postsTable.sourceUrl} LIKE ${SOURCE_PREFIX + "%"} AND ${postsTable.imageUrl} IS NULL`);
  if (rows.length === 0) return;
  let updated = 0;
  for (const row of rows) {
    const slug = row.sourceUrl?.slice(SOURCE_PREFIX.length);
    if (!slug) continue;
    await db
      .update(postsTable)
      .set({ imageUrl: imageUrlForSlug(slug) })
      .where(eq(postsTable.id, row.id));
    updated++;
  }
  if (updated > 0) {
    logger.info({ updated }, "Hardware review job backfilled image URLs");
  }
}

export function startHardwareReviewJob(): void {
  ensureHardwareReviews().catch((err) => {
    logger.error({ err }, "Initial hardware-review check failed");
  });

  setInterval(() => {
    ensureHardwareReviews().catch((err) => {
      logger.error({ err }, "Hourly hardware-review check failed");
    });
  }, CHECK_INTERVAL_MS).unref();
}
