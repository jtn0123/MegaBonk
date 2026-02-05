#!/usr/bin/env node
/**
 * Script to add tags to items.json and tomes.json
 */

const fs = require('fs');
const path = require('path');

// Tag definitions for items based on their id
const itemTags = {
    anvil: ['weapon-upgrade', 'one-and-done'],
    beefy_ring: ['damage', 'hp', 'scaling'],
    big_bonk: ['damage', 'crit', 'proc'],
    spicy_meatball: ['damage', 'aoe', 'proc'],
    gym_sauce: ['damage'],
    forbidden_juice: ['crit'],
    oats: ['hp', 'defense'],
    sucky_magnet: ['utility', 'xp', 'one-and-done'],
    za_warudo: ['survival', 'defense'],
    holy_book: ['hp', 'regen', 'damage', 'proc'],
    chonkplate: ['hp', 'lifesteal', 'defense'],
    demonic_soul: ['damage', 'scaling'],
    overpowered_lamp: ['proc', 'damage'],
    cursed_doll: ['damage', 'elite'],
    lightning_orb: ['lightning', 'proc', 'cc'],
    turbo_skates: ['attack-speed', 'speed', 'scaling'],
    grandmas_secret_tonic: ['crit', 'aoe'],
    ice_cube: ['ice', 'proc', 'cc'],
    dragonfire: ['fire', 'proc', 'dot'],
    beer: ['damage', 'risk-reward'],
    demonic_blood: ['hp', 'scaling'],
    turbo_socks: ['speed'],
    battery: ['attack-speed'],
    medkit: ['regen', 'defense'],
    clover: ['luck', 'utility'],
    moldy_cheese: ['poison', 'proc', 'dot'],
    borgar: ['cosmetic'],
    boss_buster: ['damage', 'elite'],
    spiky_shield: ['armor', 'thorns', 'defense'],
    joes_dagger: ['damage', 'scaling', 'execute'],
    bloody_cleaver: ['lifesteal', 'bloodmark', 'proc'],
    soul_harvester: ['summon', 'damage'],
    energy_core: ['summon', 'damage'],
    speed_boi: ['damage', 'conditional', 'risk-reward'],
    giant_fork: ['crit', 'damage'],
    power_gloves: ['knockback', 'proc', 'cc'],
    backpack: ['projectile', 'damage'],
    tactical_glasses: ['damage', 'conditional', 'elite'],
    wrench: ['shrine', 'utility'],
    slippery_ring: ['evasion', 'defense'],
    golden_glove: ['gold', 'utility'],
    time_bracelet: ['xp', 'utility'],
    eagle_claw: ['airborne', 'damage', 'proc'],
    gamer_goggles: ['damage', 'conditional', 'risk-reward'],
    gas_mask: ['poison', 'armor', 'defense'],
    cursed_grabbies: ['curse', 'risk-reward'],
    shattered_knowledge: ['xp', 'damage', 'passive'],
    slutty_cannon: ['aoe', 'proc', 'damage'],
    toxic_barrel: ['poison', 'on-damage', 'aoe'],
    beacon: ['shrine', 'regen', 'utility'],
    cowards_cloak: ['speed', 'defense'],
    demonic_blade: ['crit', 'lifesteal'],
    echo_shard: ['projectile', 'xp', 'damage'],
    golden_shield: ['gold', 'on-damage'],
    golden_sneakers: ['gold', 'speed'],
    idle_juice: ['damage', 'conditional'],
    kevin: ['on-damage', 'poison', 'proc'],
    leeching_crystal: ['hp', 'risk-reward'],
    mirror: ['defense', 'damage', 'on-damage'],
    moldy_gloves: ['poison', 'aoe', 'proc'],
    phantom_shroud: ['evasion', 'speed', 'defense'],
    slurp_gloves: ['lifesteal', 'aoe', 'bloodmark'],
    thunder_mitts: ['lightning', 'damage'],
    unstable_transfusion: ['bloodmark', 'proc'],
    brass_knuckles: ['damage', 'aura'],
    bob_dead: ['summon', 'speed'],
    cactus: ['thorns', 'on-damage'],
    campfire: ['regen', 'conditional'],
    credit_card_green: ['luck', 'scaling'],
    credit_card_red: ['damage', 'scaling'],
    electric_plug: ['lightning', 'on-damage'],
    feathers: ['airborne', 'mobility'],
    ghost: ['summon', 'utility'],
    ice_crystal: ['ice', 'execute', 'cc'],
    key: ['utility', 'gold'],
    scarf: ['airborne', 'damage', 'conditional'],
    skuleg: ['summon', 'risk-reward'],
    quins_mask: ['thorns', 'aoe', 'proc'],
};

// Tag definitions for tomes based on their id
const tomeTags = {
    damage: ['damage', 'offense'],
    precision: ['crit', 'offense'],
    cooldown: ['attack-speed', 'offense', 'proc'],
    hp: ['hp', 'defense', 'survival'],
    agility: ['speed', 'mobility'],
    size: ['aoe', 'offense'],
    shield: ['defense', 'survival'],
    regen: ['regen', 'defense', 'survival'],
    evasion: ['evasion', 'defense'],
    knockback: ['knockback', 'cc', 'utility'],
    projectile_speed: ['projectile', 'utility'],
    quantity: ['projectile', 'offense', 'damage'],
    duration: ['duration', 'dot', 'cc'],
    armor: ['armor', 'defense'],
    bloody: ['lifesteal', 'survival'],
    thorns: ['thorns', 'defense', 'damage'],
    xp: ['xp', 'utility', 'scaling'],
    luck: ['luck', 'utility'],
    gold: ['gold', 'utility'],
    silver: ['silver', 'utility', 'meta'],
    attraction: ['utility', 'xp'],
    cursed: ['difficulty', 'risk-reward'],
    chaos: ['rng', 'random'],
};

// Read and update items.json
const itemsPath = path.join(__dirname, '..', 'data', 'items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));

itemsData.items.forEach(item => {
    if (itemTags[item.id]) {
        item.tags = itemTags[item.id];
    } else {
        console.warn(`Warning: No tags defined for item: ${item.id}`);
        item.tags = ['uncategorized'];
    }
});

fs.writeFileSync(itemsPath, JSON.stringify(itemsData, null, 2) + '\n');
console.log(`Updated ${itemsData.items.length} items with tags`);

// Read and update tomes.json
const tomesPath = path.join(__dirname, '..', 'data', 'tomes.json');
const tomesData = JSON.parse(fs.readFileSync(tomesPath, 'utf8'));

tomesData.tomes.forEach(tome => {
    if (tomeTags[tome.id]) {
        tome.tags = tomeTags[tome.id];
    } else {
        console.warn(`Warning: No tags defined for tome: ${tome.id}`);
        tome.tags = ['uncategorized'];
    }
});

fs.writeFileSync(tomesPath, JSON.stringify(tomesData, null, 2) + '\n');
console.log(`Updated ${tomesData.tomes.length} tomes with tags`);

console.log('Done! Tags added successfully.');
