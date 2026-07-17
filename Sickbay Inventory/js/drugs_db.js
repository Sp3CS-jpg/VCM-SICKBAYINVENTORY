/* Lightweight synthetic drug master generator (~1000 entries)
   This creates `window.drugMasterList` — a large local list used for suggestions
   and duplicate detection. The names are synthetic but unique.
*/
(function(){
    const syllables = [
        'ac', 'am', 'ci', 'ce', 'do', 'ma', 'le', 'tri', 'pro', 'nor', 'fer', 'zen', 'oxi', 'gaba', 'sero', 'lipo',
        'hydro', 'metro', 'nitro', 'pred', 'iso', 'fluo', 'leva', 'moxi', 'cef', 'pen', 'sul', 'ket', 'bena', 'clo', 'dexa'
    ];

    const endings = ['cin','mox','zole','flox','pril','sartan','azole','vir','statin','oline','amide','tone','azole','ceptin','mycin'];

    const seed = [];
    for (let i=0;i<50;i++) {
        const a = syllables[Math.floor(Math.random()*syllables.length)];
        const b = syllables[Math.floor(Math.random()*syllables.length)];
        const c = endings[Math.floor(Math.random()*endings.length)];
        seed.push((a+b+c).replace(/[^a-z]/g,''));
    }

    const drugMasterList = [];
    let counter = 1;
    while (drugMasterList.length < 1000) {
        const base = seed[Math.floor(Math.random()*seed.length)];
        const variant = Math.random() > 0.8 ? '-' + String(counter % 300) : '';
        const name = (base.charAt(0).toUpperCase() + base.slice(1)) + variant;
        if (!drugMasterList.includes(name)) {
            drugMasterList.push(name);
        }
        counter++;
    }

    // expose globally
    window.drugMasterList = drugMasterList;
})();
