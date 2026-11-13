=== Market Rush ===
Contributors: thetechforge
Tags: game, puzzle, match-3, shortcode
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPL-2.0-or-later

A colourful match-3 puzzle game set in a Lagos fruit market. 30 levels, special fruits, cascades and sound.

== Description ==

Swap neighbouring fruits to line up three or more of the same kind.

* Match 4 in a line to make a striped fruit that clears a whole row or column.
* Match 5, or make an L or T shape, to make a bomb that clears the 3x3 area around it.
* Specials set each other off in chain reactions.
* 30 hand-designed levels with shaped boards (diamonds, crosses, hourglasses, holes).
* Baskets: break them by matching next to them. Tied baskets take two hits.
* Sand: sweep it by making matches on top of it. Thick sand takes two sweeps.
* Four goal types: reach a score, collect a fruit, break all baskets, sweep all sand.
* Difficulty rises steadily, with 1 to 3 stars per level.
* Progress, stars and sound setting are saved in the player's browser.
* Works with mouse and touch (tap two fruits, or swipe).

There are no ads, no lives and no purchases. Retrying a level is always free.

Difficulty balancing: if a player falls well behind the pace for a level, new fruits drop in slightly
more helpfully. If they are far ahead, drops become slightly less generous. It only affects which fruit
falls in, never scores, rewards or prices. Turn it off with assist="off".

== Installation ==

1. Upload the `market-rush` folder to `/wp-content/plugins/`, or upload the zip under Plugins > Add New > Upload Plugin.
2. Activate the plugin.
3. Add `[market_rush]` to any page or post.

== Shortcode options ==

[market_rush]                      Default game.
[market_rush assist="off"]         Pure random drops, no balancing.
[market_rush max_width="600"]      Bigger board (240 to 720 pixels).

== Changelog ==

= 1.1.0 =
* 30 hand-designed level layouts with holes, baskets and sand.
* Two new goal types: break baskets and sweep sand.
* Fruit slides diagonally around baskets, and pops up in fenced-in spaces.
* Moves and targets retuned by simulation for a smooth difficulty curve.

= 1.0.0 =
* First release.
