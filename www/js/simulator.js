/* Transparent illustrative model. All assumptions are scenario inputs, not flight-certified estimates. */
function calculateScenario(input) {
  const { age, degradation, fuel, repair, replace, solar } = input,
    horizon = 5,
    discount = 0.08,
    annualMissionValue = 22;
  const baseHazard = Math.min(
    0.48,
    Math.max(
      0.015,
      (age / 18) ** 2 * 0.09 + degradation * 0.006 + (100 - fuel) * 0.0008 + (solar - 1) * 0.035,
    ),
  );
  const paths = [
    {
      key: 'keep',
      label: 'Keep operating',
      cost: 0,
      hazard: baseHazard,
      continuity: 1,
      sustainability: 76,
    },
    {
      key: 'service',
      label: 'In-orbit service',
      cost: repair,
      hazard: Math.max(0.018, baseHazard * 0.48),
      continuity: 0.88,
      sustainability: 88,
    },
    {
      key: 'replace',
      label: 'Deorbit & replace',
      cost: replace,
      hazard: 0.035,
      continuity: 0.72,
      sustainability: 42,
    },
  ].map((p) => {
    let pv = 0,
      survival = 1;
    for (let y = 1; y <= horizon; y++) {
      survival *= 1 - p.hazard;
      pv += (annualMissionValue * p.continuity * survival) / (1 + discount) ** y;
    }
    return {
      ...p,
      operatingValue: Math.round(pv),
      npv: Math.round(pv - p.cost),
      risk: Math.round((1 - survival) * 100),
    };
  });
  const best = [...paths].sort((a, b) => b.npv - a.npv)[0];
  const fail = best.risk;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        best.sustainability -
          (best.key === 'replace' ? 10 : 0) +
          (fuel > 50 ? 3 : 0) -
          (solar > 1.4 ? 8 : 0),
      ),
    ),
  );
  let stable = 0,
    total = 0;
  for (const hazardScale of [0.8, 1, 1.2])
    for (const valueScale of [0.8, 1, 1.2]) {
      total++;
      let winner = '';
      let top = -Infinity;
      for (const p of [
        { key: 'keep', cost: 0, hazard: baseHazard, continuity: 1 },
        {
          key: 'service',
          cost: repair,
          hazard: Math.max(0.018, baseHazard * 0.48),
          continuity: 0.88,
        },
        { key: 'replace', cost: replace, hazard: 0.035, continuity: 0.72 },
      ]) {
        let survival = 1,
          pv = 0;
        for (let y = 1; y <= horizon; y++) {
          survival *= 1 - p.hazard * hazardScale;
          pv += (annualMissionValue * valueScale * p.continuity * survival) / (1 + discount) ** y;
        }
        const value = pv - p.cost;
        if (value > top) {
          top = value;
          winner = p.key;
        }
      }
      if (winner === best.key) stable++;
    }
  return {
    paths,
    best,
    fail,
    score,
    robustness: Math.round((stable / total) * 100),
    annualMissionValue,
    discount,
  };
}
window.calculateScenario = calculateScenario;
