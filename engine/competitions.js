/* BIG BROTHER 23 — OFFICIAL COMPETITION DATABASE / ENGINE */
(function(){
  const FALLBACK={physical:.35,mental:.30,social:.15,strategic:.20};
  const CAT_LABEL={physical:"Physical",mental:"Mental",social:"Social",strategic:"Strategic",general:"General"};
  function scheduleFor(opts={}){
    const cfg=window.BB23_CONFIG?.competitionSchedule||[];
    if(opts.week!=null && opts.type){
      const exact=cfg.find(c=>c.week===opts.week&&c.type===opts.type);
      if(exact)return exact;
    }
    return null;
  }
  function pickCategory(){const r=Math.random();let a=0;for(const [k,w] of Object.entries(FALLBACK)){a+=w;if(r<=a)return k}return "physical";}
  function skillScore(hg,skills){
    const vals=Object.entries(skills||{}).map(([k,w])=>((hg.competitionSkills&&hg.competitionSkills[k])??hg.ratings[k]??hg.ratings.general)*w);
    return vals.length?vals.reduce((a,b)=>a+b,0):hg.ratings.general;
  }
  function runCompetition(candidates,opts={}){
    if(!candidates?.length)return null;
    const schedule=scheduleFor(opts);
    const category=opts.category||schedule?.category||schedule?.primaryCategory||pickCategory();
    const label=schedule?.name||opts.label||`${CAT_LABEL[category]||"Big Brother"} Competition`;
    const description=schedule?.description||opts.description||"A Big Brother competition where skill, timing and strategy determine the winner.";
    const weights=schedule?.skills||({[category]:.7,general:.3});
    const scored=candidates.map(h=>{const base=skillScore(h,weights);const noise=(opts.noiseMin??.82)+Math.random()*((opts.noiseMax??1.18)-(opts.noiseMin??.82));return{hg:h,score:base*noise}}).sort((a,b)=>b.score-a.score);
    return {category,label,description,name:label,winner:scored[0].hg,ranking:scored.map(x=>({id:x.hg.id,score:Math.round(x.score*10)/10})),official:!!schedule,type:opts.type||null,week:opts.week??null};
  }
  function getCompetition(week,type){return scheduleFor({week,type});}
  window.Competitions={runCompetition,pickCategory,getCompetition,competitionLabel:c=>c?.name||c?.label||c,competitionDescription:c=>c?.description||""};
})();
