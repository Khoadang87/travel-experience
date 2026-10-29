# Side-street connection status

Contextual turn/entrance prompts are implemented. A real connection appears only
near a configured junction timestamp, lands at the destination's entry time, and
preserves the chosen quality. Prompts are tested with isolated fixture routes;
these fixtures are not in the live route catalog.

The live catalog still has one street recording and zero connections. Therefore
no real side-street turn or new interior has been activated.

Grok performed a web-search-assisted source investigation. It did not return a
verified reusable 360 walking clip that can be matched to the opening junction.
This is a search result, not proof that no suitable recording exists. Candidate
source families included Wikimedia Commons, 360Cities, YouTube, and DeoVR.
Existing panoramas/stills cannot supply continuous walking down a side street.
Attribution alone does not establish permission to reuse a candidate recording.

Useful source references for further verification:

- Current recording: https://www.youtube.com/watch?v=CErfnBokWYM
- Wikimedia Commons collection: https://commons.wikimedia.org/wiki/Category:Hoi_An
- Candidate 360 platform listing surfaced by search: https://deovr.com/hb0w3h
  (not verified as a reusable matching branch)

To activate the requested turn, provide a permitted 360 recording starting at
this same junction and continuing along the alternate street. Verify the junction
and viewing orientation; prepare its forward/reverse media and manifest; then add
the destination route and a source connection in routes.json. Add an explicit
return connection if users should be able to come back. Building/temple footage
follows the same process. Do not substitute an unrelated place or activate a
placeholder as though it were a real connected street.
