/* BIG BROTHER 23 — COMPETITION ENGINE */
(function(){
  const FALLBACK={physical:.35,mental:.30,social:.15,strategic:.20};
  function pickCategory(){const r=Math.random();let a=0;for(const [k,w] of Object.entries(FALLBACK)){a+=w;if(r<=a)return k}return "physical";}
  function scheduleFor(opts){
    const cfg=window.BB23_CONFIG?.competitionSchedule||[];
    if(opts.week!=null&&opts.type){const exact=cfg.find(c=>c.week===opts.week&&c.type===opts.type);if(exact)return exact;}
    return null;
  }
  function skillScore(hg,skills){
    const vals=Object.entries(skills||{}).map(([k,w])=>((hg.competitionSkills&&hg.competitionSkills[k])??hg.ratings[k]??hg.ratings.general)*w);
    if(vals.length)return vals.reduce((a,b)=>a+b,0);
    return hg.ratings.general;
  }
  function runCompetition(candidates,opts={}){
    if(!candidates?.length)return null;
    const schedule=scheduleFor(opts);
    const category=opts.category||schedule?.primaryCategory||pickCategory();
    const label=schedule?.name||opts.label||({physical:"Physical Competition",mental:"Mental Competition",social:"Social Competition",strategic:"Strategic Competition"}[category]||"Big Brother Competition");
    const weights=schedule?.skills||({[category]:.7,general:.3});
    const scored=candidates.map(h=>{const base=skillScore(h,weights);const noise=(opts.noiseMin??.82)+Math.random()*((opts.noiseMax??1.18)-(opts.noiseMin??.82));return{hg:h,score:base*noise}}).sort((a,b)=>b.score-a.score);
    return{category,label,winner:scored[0].hg,ranking:scored.map(x=>({id:x.hg.id,score:Math.round(x.score*10)/10}))};
  }
  window.Competitions={runCompetition,pickCategory,competitionLabel:(c)=>c};
})();
