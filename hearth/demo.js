// Demo scenes for screenshots and the portfolio showcase.
// Usage: index.html?demo=today&at=survey&assistant=stressed&level=7
// Nothing here runs without ?demo=, and demo data is never written to storage.
(function () {
  const params = new URLSearchParams(location.search);
  const scene = params.get("demo");
  if (!scene) return;

  function isoDaysAgo(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - days);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  const pastGoals = [
    ["🙏 Name three things you are grateful for.", "💧 Drink some water and make steady progress.", "💛 Take one small, caring step for yourself today."],
    ["☀️ Go for a walk and enjoy your bright energy.", "🚀 Move one important idea forward.", "✨ Notice what is supporting your mood and carry one of those small sparks forward."],
    ["🌿 Take a few deep breaths and be gentle with yourself.", "🌙 Take a nap, listen to music, or practice mindfulness.", "🫶 Offer yourself one gentle, grounding moment for how you feel."]
  ];

  function pastDay(daysAgo, look) {
    const goals = pastGoals[daysAgo % 3];
    return {
      __backendId: "demo_" + daysAgo,
      date: isoDaysAgo(daysAgo),
      check_in_completed: true,
      survey_completed: true,
      goal_one: goals[0], goal_one_completed: true,
      goal_two: goals[1], goal_two_completed: daysAgo % 2 === 0,
      goal_three: goals[2], goal_three_completed: daysAgo % 3 !== 1,
      survey_feeling: "good", survey_energy: "medium", survey_stress: "low-stress", survey_mood: "",
      ...look
    };
  }

  function streakOf(days, look, today) {
    const records = [];
    for (let i = days - 1; i >= 1; i -= 1) records.push(pastDay(i, look));
    if (today) records.push({ ...pastDay(0, look), ...today });
    return records;
  }

  const scenes = {
    fresh: [],
    today: streakOf(12, { coal_count: 9, creature_color: "ember", hat_style: "straw", unlocked_items: "leaf" }, {
      check_in_completed: false,
      goal_one: "☀️ Go for a walk and enjoy your bright energy.", goal_one_completed: true,
      goal_two: "🚀 Move one important idea forward.", goal_two_completed: false,
      goal_three: "✨ Notice what is supporting your mood and carry one of those small sparks forward.", goal_three_completed: false,
      survey_feeling: "great", survey_energy: "high", survey_stress: "moderately-stressed",
      survey_mood: "Excited about the go-kart build, a little nervous about the deadline."
    }),
    checked: streakOf(12, { coal_count: 10, creature_color: "moss", hat_style: "leaf", unlocked_items: "leaf" }, {
      goal_one_completed: true, goal_two_completed: true, goal_three_completed: true,
      survey_feeling: "good", survey_energy: "medium", survey_stress: "low-stress", survey_mood: "Calm and steady."
    }),
    final: streakOf(30, { coal_count: 21, creature_color: "gold", hat_style: "crown", unlocked_items: "leaf,crown,gold" }, {
      survey_feeling: "great", survey_energy: "high", survey_stress: "low-stress", survey_mood: "Proud of a full month."
    })
  };

  // &keeper=ember&look=galaxy swaps the spark for one of Alex's characters.
  const keeper = params.get("keeper");
  const records = (scenes[scene] || []).map(record => keeper
    ? { ...record, keeper_character: keeper, keeper_look: params.get("look") || "toon" }
    : record);

  window.__hearthSeed = {
    scene: scene,
    records: records,
    at: params.get("at"),
    assistant: params.get("assistant"),
    level: Number(params.get("level")) || null
  };
})();
