import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUserId } from "./lib/auth";

export const seedGospelParallels = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("gospelParallels").first();
    if (existing) {
      throw new Error(
        "Gospel parallels already seeded. Delete existing data first if you want to re-seed.",
      );
    }

    // Data sourced from Kurt Aland, Synopsis Quattuor Evangeliorum, 13th ed. (1985)
    // via bible-researcher.com. Pericope numbers (§) reference Aland's numbering.
    const parallels = [
      // ── Birth and Childhood ──────────────────────────────────────
      // §6
      {
        label: "Genealogy of Jesus",
        passages: [
          { book: "Matthew", chapter: 1, startVerse: 2, endVerse: 17 },
          { book: "Luke", chapter: 3, startVerse: 23, endVerse: 38 },
        ],
      },
      // §7
      {
        label: "Birth of Jesus",
        passages: [
          { book: "Matthew", chapter: 1, startVerse: 18, endVerse: 25 },
          { book: "Luke", chapter: 2, startVerse: 1, endVerse: 7 },
        ],
      },
      // §8
      {
        label: "Adoration of the Infant Jesus",
        passages: [
          { book: "Matthew", chapter: 2, startVerse: 1, endVerse: 12 },
          { book: "Luke", chapter: 2, startVerse: 8, endVerse: 20 },
        ],
      },
      // §11
      {
        label: "Childhood at Nazareth",
        passages: [
          { book: "Matthew", chapter: 2, startVerse: 22, endVerse: 23 },
          { book: "Luke", chapter: 2, startVerse: 39, endVerse: 40 },
        ],
      },

      // ── Preparation for Ministry ─────────────────────────────────
      // §13
      {
        label: "John the Baptist",
        passages: [
          { book: "Matthew", chapter: 3, startVerse: 1, endVerse: 6 },
          { book: "Mark", chapter: 1, startVerse: 2, endVerse: 6 },
          { book: "Luke", chapter: 3, startVerse: 1, endVerse: 6 },
          { book: "John", chapter: 1, startVerse: 19, endVerse: 23 },
        ],
      },
      // §14
      {
        label: "John's Preaching of Repentance",
        passages: [
          { book: "Matthew", chapter: 3, startVerse: 7, endVerse: 10 },
          { book: "Luke", chapter: 3, startVerse: 7, endVerse: 9 },
        ],
      },
      // §16
      {
        label: "John's Messianic Preaching",
        passages: [
          { book: "Matthew", chapter: 3, startVerse: 11, endVerse: 12 },
          { book: "Mark", chapter: 1, startVerse: 7, endVerse: 8 },
          { book: "Luke", chapter: 3, startVerse: 15, endVerse: 18 },
          { book: "John", chapter: 1, startVerse: 24, endVerse: 28 },
        ],
      },
      // §17
      {
        label: "Imprisonment of John",
        passages: [
          { book: "Matthew", chapter: 14, startVerse: 3, endVerse: 4 },
          { book: "Mark", chapter: 6, startVerse: 17, endVerse: 18 },
          { book: "Luke", chapter: 3, startVerse: 19, endVerse: 20 },
        ],
      },
      // §18
      {
        label: "Baptism of Jesus",
        passages: [
          { book: "Matthew", chapter: 3, startVerse: 13, endVerse: 17 },
          { book: "Mark", chapter: 1, startVerse: 9, endVerse: 11 },
          { book: "Luke", chapter: 3, startVerse: 21, endVerse: 22 },
          { book: "John", chapter: 1, startVerse: 29, endVerse: 34 },
        ],
      },
      // §20
      {
        label: "The Temptation",
        passages: [
          { book: "Matthew", chapter: 4, startVerse: 1, endVerse: 11 },
          { book: "Mark", chapter: 1, startVerse: 12, endVerse: 13 },
          { book: "Luke", chapter: 4, startVerse: 1, endVerse: 13 },
        ],
      },

      // ── Early Galilean Ministry ──────────────────────────────────
      // §32
      {
        label: "Beginning of Galilean Ministry",
        passages: [
          { book: "Matthew", chapter: 4, startVerse: 13, endVerse: 17 },
          { book: "Mark", chapter: 1, startVerse: 14, endVerse: 15 },
          { book: "Luke", chapter: 4, startVerse: 14, endVerse: 15 },
          { book: "John", chapter: 4, startVerse: 43, endVerse: 46 },
        ],
      },
      // §33
      {
        label: "Rejection at Nazareth",
        passages: [
          { book: "Matthew", chapter: 13, startVerse: 53, endVerse: 58 },
          { book: "Mark", chapter: 6, startVerse: 1, endVerse: 6 },
          { book: "Luke", chapter: 4, startVerse: 16, endVerse: 30 },
        ],
      },
      // §34
      {
        label: "Calling of the First Disciples",
        passages: [
          { book: "Matthew", chapter: 4, startVerse: 18, endVerse: 22 },
          { book: "Mark", chapter: 1, startVerse: 16, endVerse: 20 },
        ],
      },
      // §35
      {
        label: "Teaching in the Synagogue at Capernaum",
        passages: [
          { book: "Mark", chapter: 1, startVerse: 21, endVerse: 22 },
          { book: "Luke", chapter: 4, startVerse: 31, endVerse: 32 },
        ],
      },
      // §36
      {
        label: "Healing of a Demoniac in the Synagogue",
        passages: [
          { book: "Mark", chapter: 1, startVerse: 23, endVerse: 28 },
          { book: "Luke", chapter: 4, startVerse: 33, endVerse: 37 },
        ],
      },
      // §37
      {
        label: "Healing of Peter's Mother-in-Law",
        passages: [
          { book: "Matthew", chapter: 8, startVerse: 14, endVerse: 15 },
          { book: "Mark", chapter: 1, startVerse: 29, endVerse: 31 },
          { book: "Luke", chapter: 4, startVerse: 38, endVerse: 39 },
        ],
      },
      // §38
      {
        label: "Sick Healed at Evening",
        passages: [
          { book: "Matthew", chapter: 8, startVerse: 16, endVerse: 17 },
          { book: "Mark", chapter: 1, startVerse: 32, endVerse: 34 },
          { book: "Luke", chapter: 4, startVerse: 40, endVerse: 41 },
        ],
      },
      // §42
      {
        label: "Cleansing of a Leper",
        passages: [
          { book: "Matthew", chapter: 8, startVerse: 1, endVerse: 4 },
          { book: "Mark", chapter: 1, startVerse: 40, endVerse: 45 },
          { book: "Luke", chapter: 5, startVerse: 12, endVerse: 16 },
        ],
      },
      // §43
      {
        label: "Healing of the Paralytic",
        passages: [
          { book: "Matthew", chapter: 9, startVerse: 1, endVerse: 8 },
          { book: "Mark", chapter: 2, startVerse: 1, endVerse: 12 },
          { book: "Luke", chapter: 5, startVerse: 17, endVerse: 26 },
        ],
      },
      // §44
      {
        label: "Calling of Levi (Matthew)",
        passages: [
          { book: "Matthew", chapter: 9, startVerse: 9, endVerse: 13 },
          { book: "Mark", chapter: 2, startVerse: 13, endVerse: 17 },
          { book: "Luke", chapter: 5, startVerse: 27, endVerse: 32 },
        ],
      },
      // §45
      {
        label: "Question about Fasting",
        passages: [
          { book: "Matthew", chapter: 9, startVerse: 14, endVerse: 17 },
          { book: "Mark", chapter: 2, startVerse: 18, endVerse: 22 },
          { book: "Luke", chapter: 5, startVerse: 33, endVerse: 39 },
        ],
      },
      // §46
      {
        label: "Plucking Grain on the Sabbath",
        passages: [
          { book: "Matthew", chapter: 12, startVerse: 1, endVerse: 8 },
          { book: "Mark", chapter: 2, startVerse: 23, endVerse: 28 },
          { book: "Luke", chapter: 6, startVerse: 1, endVerse: 5 },
        ],
      },
      // §47
      {
        label: "Man with Withered Hand",
        passages: [
          { book: "Matthew", chapter: 12, startVerse: 9, endVerse: 14 },
          { book: "Mark", chapter: 3, startVerse: 1, endVerse: 6 },
          { book: "Luke", chapter: 6, startVerse: 6, endVerse: 11 },
        ],
      },
      // §49
      {
        label: "Choosing of the Twelve",
        passages: [
          { book: "Matthew", chapter: 10, startVerse: 1, endVerse: 4 },
          { book: "Mark", chapter: 3, startVerse: 13, endVerse: 19 },
          { book: "Luke", chapter: 6, startVerse: 12, endVerse: 16 },
        ],
      },

      // ── Sermon on the Mount / Plain ──────────────────────────────
      // §51
      {
        label: "The Beatitudes",
        passages: [
          { book: "Matthew", chapter: 5, startVerse: 3, endVerse: 12 },
          { book: "Luke", chapter: 6, startVerse: 20, endVerse: 23 },
        ],
      },
      // §52
      {
        label: "Salt of the Earth",
        passages: [
          { book: "Matthew", chapter: 5, startVerse: 13, endVerse: 13 },
          { book: "Mark", chapter: 9, startVerse: 49, endVerse: 50 },
          { book: "Luke", chapter: 14, startVerse: 34, endVerse: 35 },
        ],
      },
      // §53
      {
        label: "Light of the World",
        passages: [
          { book: "Matthew", chapter: 5, startVerse: 14, endVerse: 16 },
          { book: "Mark", chapter: 4, startVerse: 21, endVerse: 21 },
          { book: "Luke", chapter: 8, startVerse: 16, endVerse: 16 },
        ],
      },
      // §59
      {
        label: "Love Your Enemies",
        passages: [
          { book: "Matthew", chapter: 5, startVerse: 43, endVerse: 48 },
          { book: "Luke", chapter: 6, startVerse: 27, endVerse: 36 },
        ],
      },
      // §62
      {
        label: "The Lord's Prayer",
        passages: [
          { book: "Matthew", chapter: 6, startVerse: 7, endVerse: 15 },
          { book: "Luke", chapter: 11, startVerse: 1, endVerse: 4 },
        ],
      },
      // §67
      {
        label: "On Anxiety",
        passages: [
          { book: "Matthew", chapter: 6, startVerse: 25, endVerse: 34 },
          { book: "Luke", chapter: 12, startVerse: 22, endVerse: 32 },
        ],
      },
      // §68
      {
        label: "On Judging",
        passages: [
          { book: "Matthew", chapter: 7, startVerse: 1, endVerse: 5 },
          { book: "Mark", chapter: 4, startVerse: 24, endVerse: 25 },
          { book: "Luke", chapter: 6, startVerse: 37, endVerse: 42 },
        ],
      },
      // §70
      {
        label: "God's Answering of Prayer",
        passages: [
          { book: "Matthew", chapter: 7, startVerse: 7, endVerse: 11 },
          { book: "Luke", chapter: 11, startVerse: 9, endVerse: 13 },
        ],
      },
      // §73
      {
        label: "By Their Fruits",
        passages: [
          { book: "Matthew", chapter: 7, startVerse: 15, endVerse: 20 },
          { book: "Luke", chapter: 6, startVerse: 43, endVerse: 45 },
        ],
      },
      // §75
      {
        label: "House Built on Rock",
        passages: [
          { book: "Matthew", chapter: 7, startVerse: 24, endVerse: 27 },
          { book: "Luke", chapter: 6, startVerse: 47, endVerse: 49 },
        ],
      },

      // ── Miracles and Ministry ────────────────────────────────────
      // §85
      {
        label: "The Centurion's Servant",
        passages: [
          { book: "Matthew", chapter: 8, startVerse: 5, endVerse: 13 },
          { book: "Luke", chapter: 7, startVerse: 1, endVerse: 10 },
          { book: "John", chapter: 4, startVerse: 46, endVerse: 54 },
        ],
      },
      // §90
      {
        label: "Stilling the Storm",
        passages: [
          { book: "Matthew", chapter: 8, startVerse: 23, endVerse: 27 },
          { book: "Mark", chapter: 4, startVerse: 35, endVerse: 41 },
          { book: "Luke", chapter: 8, startVerse: 22, endVerse: 25 },
        ],
      },
      // §91
      {
        label: "The Gadarene Demoniac",
        passages: [
          { book: "Matthew", chapter: 8, startVerse: 28, endVerse: 34 },
          { book: "Mark", chapter: 5, startVerse: 1, endVerse: 20 },
          { book: "Luke", chapter: 8, startVerse: 26, endVerse: 39 },
        ],
      },
      // §95
      {
        label: "Jairus' Daughter and the Woman with a Hemorrhage",
        passages: [
          { book: "Matthew", chapter: 9, startVerse: 18, endVerse: 26 },
          { book: "Mark", chapter: 5, startVerse: 21, endVerse: 43 },
          { book: "Luke", chapter: 8, startVerse: 40, endVerse: 56 },
        ],
      },
      // §106
      {
        label: "John the Baptist's Question",
        passages: [
          { book: "Matthew", chapter: 11, startVerse: 2, endVerse: 6 },
          { book: "Luke", chapter: 7, startVerse: 18, endVerse: 23 },
        ],
      },
      // §107
      {
        label: "Jesus' Witness concerning John",
        passages: [
          { book: "Matthew", chapter: 11, startVerse: 7, endVerse: 19 },
          { book: "Luke", chapter: 7, startVerse: 24, endVerse: 35 },
        ],
      },
      // §114
      {
        label: "The Anointing at Bethany",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 6, endVerse: 13 },
          { book: "Mark", chapter: 14, startVerse: 3, endVerse: 9 },
          { book: "Luke", chapter: 7, startVerse: 36, endVerse: 50 },
          { book: "John", chapter: 12, startVerse: 1, endVerse: 8 },
        ],
      },

      // ── Beelzebub and Signs ──────────────────────────────────────
      // §117
      {
        label: "The Beelzebub Controversy",
        passages: [
          { book: "Matthew", chapter: 12, startVerse: 22, endVerse: 30 },
          { book: "Mark", chapter: 3, startVerse: 22, endVerse: 27 },
          { book: "Luke", chapter: 11, startVerse: 14, endVerse: 23 },
        ],
      },
      // §118
      {
        label: "Sin against the Holy Spirit",
        passages: [
          { book: "Matthew", chapter: 12, startVerse: 31, endVerse: 37 },
          { book: "Mark", chapter: 3, startVerse: 28, endVerse: 30 },
        ],
      },
      // §119
      {
        label: "The Sign of Jonah",
        passages: [
          { book: "Matthew", chapter: 12, startVerse: 38, endVerse: 42 },
          { book: "Mark", chapter: 8, startVerse: 11, endVerse: 12 },
          { book: "Luke", chapter: 11, startVerse: 29, endVerse: 32 },
        ],
      },
      // §121
      {
        label: "Jesus' True Kindred",
        passages: [
          { book: "Matthew", chapter: 12, startVerse: 46, endVerse: 50 },
          { book: "Mark", chapter: 3, startVerse: 31, endVerse: 35 },
          { book: "Luke", chapter: 8, startVerse: 19, endVerse: 21 },
        ],
      },

      // ── Parables ─────────────────────────────────────────────────
      // §122
      {
        label: "Parable of the Sower",
        passages: [
          { book: "Matthew", chapter: 13, startVerse: 1, endVerse: 9 },
          { book: "Mark", chapter: 4, startVerse: 1, endVerse: 9 },
          { book: "Luke", chapter: 8, startVerse: 4, endVerse: 8 },
        ],
      },
      // §124
      {
        label: "Interpretation of the Sower",
        passages: [
          { book: "Matthew", chapter: 13, startVerse: 18, endVerse: 23 },
          { book: "Mark", chapter: 4, startVerse: 13, endVerse: 20 },
          { book: "Luke", chapter: 8, startVerse: 11, endVerse: 15 },
        ],
      },
      // §128
      {
        label: "Parable of the Mustard Seed",
        passages: [
          { book: "Matthew", chapter: 13, startVerse: 31, endVerse: 32 },
          { book: "Mark", chapter: 4, startVerse: 30, endVerse: 32 },
          { book: "Luke", chapter: 13, startVerse: 18, endVerse: 19 },
        ],
      },
      // §129
      {
        label: "Parable of the Leaven",
        passages: [
          { book: "Matthew", chapter: 13, startVerse: 33, endVerse: 33 },
          { book: "Luke", chapter: 13, startVerse: 20, endVerse: 21 },
        ],
      },
      // §130
      {
        label: "Jesus' Use of Parables",
        passages: [
          { book: "Matthew", chapter: 13, startVerse: 34, endVerse: 35 },
          { book: "Mark", chapter: 4, startVerse: 33, endVerse: 34 },
        ],
      },
      // §169
      {
        label: "Parable of the Lost Sheep",
        passages: [
          { book: "Matthew", chapter: 18, startVerse: 10, endVerse: 14 },
          { book: "Luke", chapter: 15, startVerse: 1, endVerse: 7 },
        ],
      },
      // §216
      {
        label: "Parable of the Great Supper",
        passages: [
          { book: "Matthew", chapter: 22, startVerse: 1, endVerse: 14 },
          { book: "Luke", chapter: 14, startVerse: 15, endVerse: 24 },
        ],
      },
      // §266
      {
        label: "Parable of the Talents / Pounds",
        passages: [
          { book: "Matthew", chapter: 25, startVerse: 14, endVerse: 30 },
          { book: "Luke", chapter: 19, startVerse: 11, endVerse: 27 },
        ],
      },
      // §278
      {
        label: "Parable of the Wicked Tenants",
        passages: [
          { book: "Matthew", chapter: 21, startVerse: 33, endVerse: 46 },
          { book: "Mark", chapter: 12, startVerse: 1, endVerse: 12 },
          { book: "Luke", chapter: 20, startVerse: 9, endVerse: 19 },
        ],
      },

      // ── Sending and Mission ──────────────────────────────────────
      // §142
      {
        label: "Commissioning the Twelve",
        passages: [
          { book: "Matthew", chapter: 10, startVerse: 1, endVerse: 14 },
          { book: "Mark", chapter: 6, startVerse: 6, endVerse: 13 },
          { book: "Luke", chapter: 9, startVerse: 1, endVerse: 6 },
        ],
      },
      // §143
      {
        label: "Opinions regarding Jesus",
        passages: [
          { book: "Matthew", chapter: 14, startVerse: 1, endVerse: 2 },
          { book: "Mark", chapter: 6, startVerse: 14, endVerse: 16 },
          { book: "Luke", chapter: 9, startVerse: 7, endVerse: 9 },
        ],
      },
      // §144
      {
        label: "Death of John the Baptist",
        passages: [
          { book: "Matthew", chapter: 14, startVerse: 3, endVerse: 12 },
          { book: "Mark", chapter: 6, startVerse: 17, endVerse: 29 },
          { book: "Luke", chapter: 3, startVerse: 19, endVerse: 20 },
        ],
      },

      // ── Feeding and Sea Miracles ─────────────────────────────────
      // §146
      {
        label: "Feeding of the Five Thousand",
        passages: [
          { book: "Matthew", chapter: 14, startVerse: 13, endVerse: 21 },
          { book: "Mark", chapter: 6, startVerse: 32, endVerse: 44 },
          { book: "Luke", chapter: 9, startVerse: 10, endVerse: 17 },
          { book: "John", chapter: 6, startVerse: 1, endVerse: 15 },
        ],
      },
      // §147
      {
        label: "Walking on Water",
        passages: [
          { book: "Matthew", chapter: 14, startVerse: 22, endVerse: 33 },
          { book: "Mark", chapter: 6, startVerse: 45, endVerse: 52 },
          { book: "John", chapter: 6, startVerse: 16, endVerse: 21 },
        ],
      },
      // §150
      {
        label: "Defilement — Traditional and Real",
        passages: [
          { book: "Matthew", chapter: 15, startVerse: 1, endVerse: 20 },
          { book: "Mark", chapter: 7, startVerse: 1, endVerse: 23 },
        ],
      },
      // §151
      {
        label: "The Syrophoenician Woman",
        passages: [
          { book: "Matthew", chapter: 15, startVerse: 21, endVerse: 28 },
          { book: "Mark", chapter: 7, startVerse: 24, endVerse: 30 },
        ],
      },
      // §153
      {
        label: "Feeding of the Four Thousand",
        passages: [
          { book: "Matthew", chapter: 15, startVerse: 32, endVerse: 39 },
          { book: "Mark", chapter: 8, startVerse: 1, endVerse: 10 },
        ],
      },

      // ── Peter's Confession and Transfiguration ───────────────────
      // §158
      {
        label: "Peter's Confession",
        passages: [
          { book: "Matthew", chapter: 16, startVerse: 13, endVerse: 20 },
          { book: "Mark", chapter: 8, startVerse: 27, endVerse: 30 },
          { book: "Luke", chapter: 9, startVerse: 18, endVerse: 21 },
          { book: "John", chapter: 6, startVerse: 67, endVerse: 71 },
        ],
      },
      // §159
      {
        label: "First Prediction of the Passion",
        passages: [
          { book: "Matthew", chapter: 16, startVerse: 21, endVerse: 23 },
          { book: "Mark", chapter: 8, startVerse: 31, endVerse: 33 },
          { book: "Luke", chapter: 9, startVerse: 22, endVerse: 22 },
        ],
      },
      // §160
      {
        label: "If Any Man Would Come after Me",
        passages: [
          { book: "Matthew", chapter: 16, startVerse: 24, endVerse: 28 },
          { book: "Mark", chapter: 8, startVerse: 34, endVerse: 38 },
          { book: "Luke", chapter: 9, startVerse: 23, endVerse: 27 },
        ],
      },
      // §161
      {
        label: "The Transfiguration",
        passages: [
          { book: "Matthew", chapter: 17, startVerse: 1, endVerse: 9 },
          { book: "Mark", chapter: 9, startVerse: 2, endVerse: 10 },
          { book: "Luke", chapter: 9, startVerse: 28, endVerse: 36 },
        ],
      },
      // §162
      {
        label: "The Coming of Elijah",
        passages: [
          { book: "Matthew", chapter: 17, startVerse: 10, endVerse: 13 },
          { book: "Mark", chapter: 9, startVerse: 11, endVerse: 13 },
        ],
      },
      // §163
      {
        label: "Healing of a Boy with an Unclean Spirit",
        passages: [
          { book: "Matthew", chapter: 17, startVerse: 14, endVerse: 21 },
          { book: "Mark", chapter: 9, startVerse: 14, endVerse: 29 },
          { book: "Luke", chapter: 9, startVerse: 37, endVerse: 43 },
        ],
      },
      // §164
      {
        label: "Second Prediction of the Passion",
        passages: [
          { book: "Matthew", chapter: 17, startVerse: 22, endVerse: 23 },
          { book: "Mark", chapter: 9, startVerse: 30, endVerse: 32 },
          { book: "Luke", chapter: 9, startVerse: 43, endVerse: 45 },
        ],
      },
      // §166
      {
        label: "True Greatness",
        passages: [
          { book: "Matthew", chapter: 18, startVerse: 1, endVerse: 5 },
          { book: "Mark", chapter: 9, startVerse: 33, endVerse: 37 },
          { book: "Luke", chapter: 9, startVerse: 46, endVerse: 48 },
        ],
      },

      // ── Journey to Jerusalem ─────────────────────────────────────
      // §182
      {
        label: "The Greatest Commandment",
        passages: [
          { book: "Matthew", chapter: 22, startVerse: 34, endVerse: 40 },
          { book: "Mark", chapter: 12, startVerse: 28, endVerse: 34 },
          { book: "Luke", chapter: 10, startVerse: 25, endVerse: 28 },
        ],
      },
      // §252
      {
        label: "On Divorce",
        passages: [
          { book: "Matthew", chapter: 19, startVerse: 3, endVerse: 12 },
          { book: "Mark", chapter: 10, startVerse: 2, endVerse: 12 },
        ],
      },
      // §253
      {
        label: "Jesus Blesses the Children",
        passages: [
          { book: "Matthew", chapter: 19, startVerse: 13, endVerse: 15 },
          { book: "Mark", chapter: 10, startVerse: 13, endVerse: 16 },
          { book: "Luke", chapter: 18, startVerse: 15, endVerse: 17 },
        ],
      },
      // §254
      {
        label: "The Rich Young Man",
        passages: [
          { book: "Matthew", chapter: 19, startVerse: 16, endVerse: 22 },
          { book: "Mark", chapter: 10, startVerse: 17, endVerse: 22 },
          { book: "Luke", chapter: 18, startVerse: 18, endVerse: 23 },
        ],
      },
      // §255
      {
        label: "On Riches and the Rewards of Discipleship",
        passages: [
          { book: "Matthew", chapter: 19, startVerse: 23, endVerse: 30 },
          { book: "Mark", chapter: 10, startVerse: 23, endVerse: 31 },
          { book: "Luke", chapter: 18, startVerse: 24, endVerse: 30 },
        ],
      },
      // §262
      {
        label: "Third Prediction of the Passion",
        passages: [
          { book: "Matthew", chapter: 20, startVerse: 17, endVerse: 19 },
          { book: "Mark", chapter: 10, startVerse: 32, endVerse: 34 },
          { book: "Luke", chapter: 18, startVerse: 31, endVerse: 34 },
        ],
      },
      // §263
      {
        label: "The Sons of Zebedee: Precedence among Disciples",
        passages: [
          { book: "Matthew", chapter: 20, startVerse: 20, endVerse: 28 },
          { book: "Mark", chapter: 10, startVerse: 35, endVerse: 45 },
        ],
      },
      // §264
      {
        label: "Healing of the Blind",
        passages: [
          { book: "Matthew", chapter: 20, startVerse: 29, endVerse: 34 },
          { book: "Mark", chapter: 10, startVerse: 46, endVerse: 52 },
          { book: "Luke", chapter: 18, startVerse: 35, endVerse: 43 },
        ],
      },

      // ── Final Ministry in Jerusalem ──────────────────────────────
      // §269
      {
        label: "The Triumphal Entry",
        passages: [
          { book: "Matthew", chapter: 21, startVerse: 1, endVerse: 9 },
          { book: "Mark", chapter: 11, startVerse: 1, endVerse: 10 },
          { book: "Luke", chapter: 19, startVerse: 28, endVerse: 40 },
          { book: "John", chapter: 12, startVerse: 12, endVerse: 19 },
        ],
      },
      // §272
      {
        label: "The Cursing of the Fig Tree",
        passages: [
          { book: "Matthew", chapter: 21, startVerse: 18, endVerse: 19 },
          { book: "Mark", chapter: 11, startVerse: 12, endVerse: 14 },
        ],
      },
      // §273
      {
        label: "The Cleansing of the Temple",
        passages: [
          { book: "Matthew", chapter: 21, startVerse: 12, endVerse: 13 },
          { book: "Mark", chapter: 11, startVerse: 15, endVerse: 17 },
          { book: "Luke", chapter: 19, startVerse: 45, endVerse: 46 },
          { book: "John", chapter: 2, startVerse: 13, endVerse: 17 },
        ],
      },
      // §276
      {
        label: "The Question about Authority",
        passages: [
          { book: "Matthew", chapter: 21, startVerse: 23, endVerse: 27 },
          { book: "Mark", chapter: 11, startVerse: 27, endVerse: 33 },
          { book: "Luke", chapter: 20, startVerse: 1, endVerse: 8 },
        ],
      },
      // §280
      {
        label: "Paying Tribute to Caesar",
        passages: [
          { book: "Matthew", chapter: 22, startVerse: 15, endVerse: 22 },
          { book: "Mark", chapter: 12, startVerse: 13, endVerse: 17 },
          { book: "Luke", chapter: 20, startVerse: 20, endVerse: 26 },
        ],
      },
      // §281
      {
        label: "The Question about the Resurrection",
        passages: [
          { book: "Matthew", chapter: 22, startVerse: 23, endVerse: 33 },
          { book: "Mark", chapter: 12, startVerse: 18, endVerse: 27 },
          { book: "Luke", chapter: 20, startVerse: 27, endVerse: 40 },
        ],
      },
      // §283
      {
        label: "The Question about David's Son",
        passages: [
          { book: "Matthew", chapter: 22, startVerse: 41, endVerse: 46 },
          { book: "Mark", chapter: 12, startVerse: 35, endVerse: 37 },
          { book: "Luke", chapter: 20, startVerse: 41, endVerse: 44 },
        ],
      },
      // §284
      {
        label: "Woe to the Scribes and Pharisees",
        passages: [
          { book: "Matthew", chapter: 23, startVerse: 1, endVerse: 36 },
          { book: "Mark", chapter: 12, startVerse: 37, endVerse: 40 },
          { book: "Luke", chapter: 20, startVerse: 45, endVerse: 47 },
        ],
      },
      // §286
      {
        label: "The Widow's Offering",
        passages: [
          { book: "Mark", chapter: 12, startVerse: 41, endVerse: 44 },
          { book: "Luke", chapter: 21, startVerse: 1, endVerse: 4 },
        ],
      },

      // ── Olivet Discourse ─────────────────────────────────────────
      // §287
      {
        label: "Prediction of the Destruction of the Temple",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 1, endVerse: 2 },
          { book: "Mark", chapter: 13, startVerse: 1, endVerse: 2 },
          { book: "Luke", chapter: 21, startVerse: 5, endVerse: 6 },
        ],
      },
      // §288
      {
        label: "Signs before the End",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 3, endVerse: 8 },
          { book: "Mark", chapter: 13, startVerse: 3, endVerse: 8 },
          { book: "Luke", chapter: 21, startVerse: 7, endVerse: 11 },
        ],
      },
      // §289
      {
        label: "Persecutions Foretold",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 9, endVerse: 14 },
          { book: "Mark", chapter: 13, startVerse: 9, endVerse: 13 },
          { book: "Luke", chapter: 21, startVerse: 12, endVerse: 19 },
        ],
      },
      // §290
      {
        label: "The Desolating Sacrilege",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 15, endVerse: 22 },
          { book: "Mark", chapter: 13, startVerse: 14, endVerse: 20 },
          { book: "Luke", chapter: 21, startVerse: 20, endVerse: 24 },
        ],
      },
      // §291
      {
        label: "False Christs and False Prophets",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 23, endVerse: 28 },
          { book: "Mark", chapter: 13, startVerse: 21, endVerse: 23 },
        ],
      },
      // §292
      {
        label: "The Coming of the Son of Man",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 29, endVerse: 31 },
          { book: "Mark", chapter: 13, startVerse: 24, endVerse: 27 },
          { book: "Luke", chapter: 21, startVerse: 25, endVerse: 28 },
        ],
      },
      // §293
      {
        label: "Parable of the Fig Tree: the Time of the Coming",
        passages: [
          { book: "Matthew", chapter: 24, startVerse: 32, endVerse: 36 },
          { book: "Mark", chapter: 13, startVerse: 28, endVerse: 32 },
          { book: "Luke", chapter: 21, startVerse: 29, endVerse: 33 },
        ],
      },

      // ── Passion Narrative ────────────────────────────────────────
      // §305
      {
        label: "The Plot to Kill Jesus",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 1, endVerse: 5 },
          { book: "Mark", chapter: 14, startVerse: 1, endVerse: 2 },
          { book: "Luke", chapter: 22, startVerse: 1, endVerse: 2 },
        ],
      },
      // §307
      {
        label: "The Betrayal by Judas",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 14, endVerse: 16 },
          { book: "Mark", chapter: 14, startVerse: 10, endVerse: 11 },
          { book: "Luke", chapter: 22, startVerse: 3, endVerse: 6 },
        ],
      },
      // §308
      {
        label: "Preparation for the Passover",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 17, endVerse: 20 },
          { book: "Mark", chapter: 14, startVerse: 12, endVerse: 17 },
          { book: "Luke", chapter: 22, startVerse: 7, endVerse: 14 },
        ],
      },
      // §310
      {
        label: "Jesus Foretells His Betrayal",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 21, endVerse: 25 },
          { book: "Mark", chapter: 14, startVerse: 18, endVerse: 21 },
          { book: "Luke", chapter: 22, startVerse: 21, endVerse: 23 },
          { book: "John", chapter: 13, startVerse: 21, endVerse: 30 },
        ],
      },
      // §311
      {
        label: "The Last Supper",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 26, endVerse: 29 },
          { book: "Mark", chapter: 14, startVerse: 22, endVerse: 25 },
          { book: "Luke", chapter: 22, startVerse: 15, endVerse: 20 },
        ],
      },
      // §315
      {
        label: "Peter's Denial Predicted",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 30, endVerse: 35 },
          { book: "Mark", chapter: 14, startVerse: 26, endVerse: 31 },
          { book: "Luke", chapter: 22, startVerse: 31, endVerse: 34 },
          { book: "John", chapter: 13, startVerse: 36, endVerse: 38 },
        ],
      },
      // §330
      {
        label: "Gethsemane",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 36, endVerse: 46 },
          { book: "Mark", chapter: 14, startVerse: 32, endVerse: 42 },
          { book: "Luke", chapter: 22, startVerse: 39, endVerse: 46 },
        ],
      },
      // §331
      {
        label: "The Arrest of Jesus",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 47, endVerse: 56 },
          { book: "Mark", chapter: 14, startVerse: 43, endVerse: 52 },
          { book: "Luke", chapter: 22, startVerse: 47, endVerse: 53 },
          { book: "John", chapter: 18, startVerse: 2, endVerse: 12 },
        ],
      },
      // §332
      {
        label: "Jesus before the Sanhedrin",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 57, endVerse: 68 },
          { book: "Mark", chapter: 14, startVerse: 53, endVerse: 65 },
          { book: "Luke", chapter: 22, startVerse: 54, endVerse: 71 },
          { book: "John", chapter: 18, startVerse: 13, endVerse: 24 },
        ],
      },
      // §333
      {
        label: "Peter's Denial",
        passages: [
          { book: "Matthew", chapter: 26, startVerse: 69, endVerse: 75 },
          { book: "Mark", chapter: 14, startVerse: 66, endVerse: 72 },
          { book: "Luke", chapter: 22, startVerse: 56, endVerse: 62 },
          { book: "John", chapter: 18, startVerse: 25, endVerse: 27 },
        ],
      },
      // §336
      {
        label: "The Trial before Pilate",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 11, endVerse: 14 },
          { book: "Mark", chapter: 15, startVerse: 2, endVerse: 5 },
          { book: "Luke", chapter: 23, startVerse: 2, endVerse: 5 },
          { book: "John", chapter: 18, startVerse: 29, endVerse: 38 },
        ],
      },
      // §339
      {
        label: "Jesus or Barabbas",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 15, endVerse: 23 },
          { book: "Mark", chapter: 15, startVerse: 6, endVerse: 14 },
          { book: "Luke", chapter: 23, startVerse: 17, endVerse: 23 },
          { book: "John", chapter: 18, startVerse: 39, endVerse: 40 },
        ],
      },
      // §341
      {
        label: "Pilate Delivers Jesus to be Crucified",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 24, endVerse: 26 },
          { book: "Mark", chapter: 15, startVerse: 15, endVerse: 15 },
          { book: "Luke", chapter: 23, startVerse: 24, endVerse: 25 },
          { book: "John", chapter: 19, startVerse: 16, endVerse: 16 },
        ],
      },
      // §342
      {
        label: "Jesus Mocked by the Soldiers",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 27, endVerse: 31 },
          { book: "Mark", chapter: 15, startVerse: 16, endVerse: 20 },
          { book: "John", chapter: 19, startVerse: 2, endVerse: 3 },
        ],
      },
      // §343
      {
        label: "The Road to Golgotha",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 31, endVerse: 32 },
          { book: "Mark", chapter: 15, startVerse: 20, endVerse: 21 },
          { book: "Luke", chapter: 23, startVerse: 26, endVerse: 32 },
          { book: "John", chapter: 19, startVerse: 17, endVerse: 17 },
        ],
      },
      // §344
      {
        label: "The Crucifixion",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 33, endVerse: 37 },
          { book: "Mark", chapter: 15, startVerse: 22, endVerse: 26 },
          { book: "Luke", chapter: 23, startVerse: 33, endVerse: 34 },
          { book: "John", chapter: 19, startVerse: 17, endVerse: 27 },
        ],
      },
      // §345
      {
        label: "Jesus Derided on the Cross",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 38, endVerse: 43 },
          { book: "Mark", chapter: 15, startVerse: 27, endVerse: 32 },
          { book: "Luke", chapter: 23, startVerse: 35, endVerse: 38 },
        ],
      },
      // §346
      {
        label: "The Two Thieves",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 44, endVerse: 44 },
          { book: "Mark", chapter: 15, startVerse: 32, endVerse: 32 },
          { book: "Luke", chapter: 23, startVerse: 39, endVerse: 43 },
        ],
      },
      // §347
      {
        label: "The Death of Jesus",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 45, endVerse: 54 },
          { book: "Mark", chapter: 15, startVerse: 33, endVerse: 39 },
          { book: "Luke", chapter: 23, startVerse: 44, endVerse: 48 },
          { book: "John", chapter: 19, startVerse: 28, endVerse: 30 },
        ],
      },
      // §348
      {
        label: "Witnesses of the Crucifixion",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 55, endVerse: 56 },
          { book: "Mark", chapter: 15, startVerse: 40, endVerse: 41 },
          { book: "Luke", chapter: 23, startVerse: 49, endVerse: 49 },
          { book: "John", chapter: 19, startVerse: 25, endVerse: 27 },
        ],
      },
      // §350
      {
        label: "The Burial of Jesus",
        passages: [
          { book: "Matthew", chapter: 27, startVerse: 57, endVerse: 61 },
          { book: "Mark", chapter: 15, startVerse: 42, endVerse: 47 },
          { book: "Luke", chapter: 23, startVerse: 50, endVerse: 56 },
          { book: "John", chapter: 19, startVerse: 38, endVerse: 42 },
        ],
      },

      // ── Resurrection ─────────────────────────────────────────────
      // §352
      {
        label: "The Women at the Empty Tomb",
        passages: [
          { book: "Matthew", chapter: 28, startVerse: 1, endVerse: 8 },
          { book: "Mark", chapter: 16, startVerse: 1, endVerse: 8 },
          { book: "Luke", chapter: 24, startVerse: 1, endVerse: 12 },
          { book: "John", chapter: 20, startVerse: 1, endVerse: 13 },
        ],
      },
      // §353
      {
        label: "Jesus Appears to the Women",
        passages: [
          { book: "Matthew", chapter: 28, startVerse: 9, endVerse: 10 },
          { book: "Mark", chapter: 16, startVerse: 9, endVerse: 11 },
          { book: "John", chapter: 20, startVerse: 14, endVerse: 18 },
        ],
      },
      // §364/365
      {
        label: "The Great Commission",
        passages: [
          { book: "Matthew", chapter: 28, startVerse: 16, endVerse: 20 },
          { book: "Luke", chapter: 24, startVerse: 44, endVerse: 53 },
        ],
      },

      // ── Notable Single-Gospel Passages (for study context) ───────

      // Unique to Luke
      {
        label: "Parable of the Good Samaritan",
        passages: [{ book: "Luke", chapter: 10, startVerse: 25, endVerse: 37 }],
      },
      {
        label: "Mary and Martha",
        passages: [{ book: "Luke", chapter: 10, startVerse: 38, endVerse: 42 }],
      },
      {
        label: "Parable of the Prodigal Son",
        passages: [{ book: "Luke", chapter: 15, startVerse: 11, endVerse: 32 }],
      },
      {
        label: "Parable of the Rich Man and Lazarus",
        passages: [{ book: "Luke", chapter: 16, startVerse: 19, endVerse: 31 }],
      },
      {
        label: "Healing of the Ten Lepers",
        passages: [{ book: "Luke", chapter: 17, startVerse: 11, endVerse: 19 }],
      },
      {
        label: "The Pharisee and the Tax Collector",
        passages: [{ book: "Luke", chapter: 18, startVerse: 9, endVerse: 14 }],
      },
      {
        label: "Zacchaeus",
        passages: [{ book: "Luke", chapter: 19, startVerse: 1, endVerse: 10 }],
      },
      {
        label: "The Road to Emmaus",
        passages: [{ book: "Luke", chapter: 24, startVerse: 13, endVerse: 35 }],
      },

      // Unique to John
      {
        label: "The Wedding at Cana",
        passages: [{ book: "John", chapter: 2, startVerse: 1, endVerse: 11 }],
      },
      {
        label: "Discourse with Nicodemus",
        passages: [{ book: "John", chapter: 3, startVerse: 1, endVerse: 21 }],
      },
      {
        label: "The Woman at the Well",
        passages: [{ book: "John", chapter: 4, startVerse: 4, endVerse: 42 }],
      },
      {
        label: "Healing at the Pool of Bethesda",
        passages: [{ book: "John", chapter: 5, startVerse: 2, endVerse: 47 }],
      },
      {
        label: "The Bread of Life Discourse",
        passages: [{ book: "John", chapter: 6, startVerse: 26, endVerse: 59 }],
      },
      {
        label: "The Light of the World",
        passages: [{ book: "John", chapter: 8, startVerse: 12, endVerse: 20 }],
      },
      {
        label: "Healing of the Man Born Blind",
        passages: [{ book: "John", chapter: 9, startVerse: 1, endVerse: 41 }],
      },
      {
        label: "The Good Shepherd",
        passages: [{ book: "John", chapter: 10, startVerse: 1, endVerse: 18 }],
      },
      {
        label: "The Raising of Lazarus",
        passages: [{ book: "John", chapter: 11, startVerse: 1, endVerse: 44 }],
      },
      {
        label: "Washing the Disciples' Feet",
        passages: [{ book: "John", chapter: 13, startVerse: 1, endVerse: 20 }],
      },
      {
        label: "The Farewell Discourse",
        passages: [
          { book: "John", chapter: 14, startVerse: 1, endVerse: 31 },
          { book: "John", chapter: 15, startVerse: 1, endVerse: 27 },
          { book: "John", chapter: 16, startVerse: 1, endVerse: 33 },
        ],
      },
      {
        label: "The High Priestly Prayer",
        passages: [{ book: "John", chapter: 17, startVerse: 1, endVerse: 26 }],
      },
      {
        label: "Appearance to Thomas",
        passages: [{ book: "John", chapter: 20, startVerse: 24, endVerse: 29 }],
      },
      {
        label: "Restoration of Peter",
        passages: [{ book: "John", chapter: 21, startVerse: 15, endVerse: 19 }],
      },
    ];

    for (const p of parallels) {
      await ctx.db.insert("gospelParallels", p);
    }
  },
});

type Testament = "OT" | "NT";

type ChapterTarget = {
  book: string;
  chapter: number;
  testament: Testament;
};

type ThemeKey =
  | "covenant-law"
  | "wisdom-discernment"
  | "prayer-worship"
  | "repentance-grace"
  | "justice-mercy"
  | "prophecy-kingdom"
  | "discipleship-mission"
  | "suffering-hope"
  | "humility-service"
  | "family-vocation"
  | "spirit-holiness"
  | "jesus-identity";

type ThemeTemplate = {
  key: ThemeKey;
  tags: string[];
  observations: string[];
  questions: string[];
  applications: string[];
};

const DEV_DEFAULT_CHAPTER_COUNT = 50;
const DEV_DEFAULT_HEAVY_CHAPTER_COUNT = 10;
const DEV_DEFAULT_BASE_NOTES = 10;
const DEV_DEFAULT_HEAVY_NOTES = 40;
const DEV_DEFAULT_OT_CHAPTERS = 30;
const DEV_MAX_NOTES_PER_VERSE = 8;
const DEV_MIN_ANCHOR_VERSES = 4;
const DEV_MAX_ANCHOR_VERSES = 8;

const STARTER_TAGS = [
  "god's character",
  "jesus",
  "holy spirit",
  "sin & repentance",
  "salvation & grace",
  "covenant",
  "law",
  "prophecy",
  "faith & trust",
  "prayer",
  "worship & praise",
  "obedience",
  "suffering & trials",
  "hope & encouragement",
  "fear & anxiety",
  "pride & humility",
  "wisdom & discernment",
  "temptation",
  "love & compassion",
  "forgiveness & reconciliation",
  "justice & mercy",
  "money & generosity",
  "marriage & family",
  "work & vocation",
  "church & community",
  "discipleship",
  "evangelism & mission",
  "leadership & service",
  "creation & fall",
  "kingdom of god",
] as const;

const BOOKS: Array<{ name: string; chapters: number; testament: Testament }> = [
  { name: "Genesis", chapters: 50, testament: "OT" },
  { name: "Exodus", chapters: 40, testament: "OT" },
  { name: "Leviticus", chapters: 27, testament: "OT" },
  { name: "Numbers", chapters: 36, testament: "OT" },
  { name: "Deuteronomy", chapters: 34, testament: "OT" },
  { name: "Joshua", chapters: 24, testament: "OT" },
  { name: "Judges", chapters: 21, testament: "OT" },
  { name: "Ruth", chapters: 4, testament: "OT" },
  { name: "1 Samuel", chapters: 31, testament: "OT" },
  { name: "2 Samuel", chapters: 24, testament: "OT" },
  { name: "1 Kings", chapters: 22, testament: "OT" },
  { name: "2 Kings", chapters: 25, testament: "OT" },
  { name: "1 Chronicles", chapters: 29, testament: "OT" },
  { name: "2 Chronicles", chapters: 36, testament: "OT" },
  { name: "Ezra", chapters: 10, testament: "OT" },
  { name: "Nehemiah", chapters: 13, testament: "OT" },
  { name: "Esther", chapters: 10, testament: "OT" },
  { name: "Job", chapters: 42, testament: "OT" },
  { name: "Psalms", chapters: 150, testament: "OT" },
  { name: "Proverbs", chapters: 31, testament: "OT" },
  { name: "Ecclesiastes", chapters: 12, testament: "OT" },
  { name: "Song of Solomon", chapters: 8, testament: "OT" },
  { name: "Isaiah", chapters: 66, testament: "OT" },
  { name: "Jeremiah", chapters: 52, testament: "OT" },
  { name: "Lamentations", chapters: 5, testament: "OT" },
  { name: "Ezekiel", chapters: 48, testament: "OT" },
  { name: "Daniel", chapters: 12, testament: "OT" },
  { name: "Hosea", chapters: 14, testament: "OT" },
  { name: "Joel", chapters: 3, testament: "OT" },
  { name: "Amos", chapters: 9, testament: "OT" },
  { name: "Obadiah", chapters: 1, testament: "OT" },
  { name: "Jonah", chapters: 4, testament: "OT" },
  { name: "Micah", chapters: 7, testament: "OT" },
  { name: "Nahum", chapters: 3, testament: "OT" },
  { name: "Habakkuk", chapters: 3, testament: "OT" },
  { name: "Zephaniah", chapters: 3, testament: "OT" },
  { name: "Haggai", chapters: 2, testament: "OT" },
  { name: "Zechariah", chapters: 14, testament: "OT" },
  { name: "Malachi", chapters: 4, testament: "OT" },
  { name: "Matthew", chapters: 28, testament: "NT" },
  { name: "Mark", chapters: 16, testament: "NT" },
  { name: "Luke", chapters: 24, testament: "NT" },
  { name: "John", chapters: 21, testament: "NT" },
  { name: "Acts", chapters: 28, testament: "NT" },
  { name: "Romans", chapters: 16, testament: "NT" },
  { name: "1 Corinthians", chapters: 16, testament: "NT" },
  { name: "2 Corinthians", chapters: 13, testament: "NT" },
  { name: "Galatians", chapters: 6, testament: "NT" },
  { name: "Ephesians", chapters: 6, testament: "NT" },
  { name: "Philippians", chapters: 4, testament: "NT" },
  { name: "Colossians", chapters: 4, testament: "NT" },
  { name: "1 Thessalonians", chapters: 5, testament: "NT" },
  { name: "2 Thessalonians", chapters: 3, testament: "NT" },
  { name: "1 Timothy", chapters: 6, testament: "NT" },
  { name: "2 Timothy", chapters: 4, testament: "NT" },
  { name: "Titus", chapters: 3, testament: "NT" },
  { name: "Philemon", chapters: 1, testament: "NT" },
  { name: "Hebrews", chapters: 13, testament: "NT" },
  { name: "James", chapters: 5, testament: "NT" },
  { name: "1 Peter", chapters: 5, testament: "NT" },
  { name: "2 Peter", chapters: 3, testament: "NT" },
  { name: "1 John", chapters: 5, testament: "NT" },
  { name: "2 John", chapters: 1, testament: "NT" },
  { name: "3 John", chapters: 1, testament: "NT" },
  { name: "Jude", chapters: 1, testament: "NT" },
  { name: "Revelation", chapters: 22, testament: "NT" },
];

const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    key: "covenant-law",
    tags: ["covenant", "law", "obedience", "god's character"],
    observations: [
      "This section highlights how God's covenant shapes daily faithfulness.",
      "The commands here frame obedience as a response to grace, not mere duty.",
      "The passage ties God's character to His covenant promises.",
    ],
    questions: [
      "Where am I treating obedience as optional rather than covenant faithfulness?",
      "What part of God's instruction do I resist because it costs me comfort?",
      "How does this passage deepen my trust in God's consistency?",
    ],
    applications: [
      "This week I want to obey quickly in one specific area I have delayed.",
      "I will pray through this command and ask for a willing heart.",
      "I need to align one practical decision with God's covenant priorities.",
    ],
  },
  {
    key: "wisdom-discernment",
    tags: ["wisdom & discernment", "faith & trust", "obedience"],
    observations: [
      "The text contrasts surface-level choices with wise, God-centered discernment.",
      "Wisdom here is relational and moral, not only intellectual.",
      "This chapter exposes the long-term fruit of small decisions.",
    ],
    questions: [
      "What decision in front of me needs patient discernment?",
      "Am I listening more to urgency or to wisdom?",
      "Where is God inviting me to trust Him instead of leaning on impulse?",
    ],
    applications: [
      "I will pause and pray before making my next major choice.",
      "I should seek counsel from a mature believer on this issue.",
      "I want to build one daily habit that trains wise attention to God.",
    ],
  },
  {
    key: "prayer-worship",
    tags: ["prayer", "worship & praise", "hope & encouragement"],
    observations: [
      "This chapter models worship that is honest about struggle and still hopeful.",
      "Prayer here is rooted in who God is, not only in what I need.",
      "The movement from lament to praise feels deeply pastoral.",
    ],
    questions: [
      "How can my prayer life become more God-centered this week?",
      "Where do I need to turn anxiety into worship?",
      "What truth about God can anchor my next prayer?",
    ],
    applications: [
      "I will spend dedicated time in thanksgiving before requests.",
      "I want to memorize one line from this chapter for prayer.",
      "I will end today by naming specific reasons to praise God.",
    ],
  },
  {
    key: "repentance-grace",
    tags: ["sin & repentance", "salvation & grace", "faith & trust"],
    observations: [
      "The passage presents repentance as a doorway into grace, not shame.",
      "God's mercy appears stronger than the failures being confronted.",
      "The call here is both truthful and deeply hopeful.",
    ],
    questions: [
      "What do I need to confess honestly before God today?",
      "Where have I minimized sin instead of bringing it into the light?",
      "How does grace reshape my response to failure?",
    ],
    applications: [
      "I will confess specifically and receive God's forgiveness with faith.",
      "I should make one concrete step of repentance, not just good intentions.",
      "I want to remember that grace changes both guilt and direction.",
    ],
  },
  {
    key: "justice-mercy",
    tags: ["justice & mercy", "love & compassion", "leadership & service"],
    observations: [
      "This chapter refuses to separate true justice from mercy.",
      "God's concern for the vulnerable is central, not peripheral.",
      "Leadership in this text is measured by integrity and compassion.",
    ],
    questions: [
      "Who around me is being overlooked and needs practical care?",
      "Where am I tempted to choose comfort over justice?",
      "How can I mirror God's mercy in a hard relationship?",
    ],
    applications: [
      "I will take one practical action for someone with less voice.",
      "I should evaluate my influence through the lens of service.",
      "I want to practice mercy without lowering my commitment to truth.",
    ],
  },
  {
    key: "prophecy-kingdom",
    tags: ["prophecy", "kingdom of god", "hope & encouragement"],
    observations: [
      "The prophetic vision lifts the horizon toward God's future kingdom.",
      "Judgment and hope are held together with moral clarity.",
      "This text calls for present faithfulness in light of promised restoration.",
    ],
    questions: [
      "How does God's future kingdom reshape my present priorities?",
      "Where do I need hope that is anchored in God's promises?",
      "What habits would change if I truly believed this promise?",
    ],
    applications: [
      "I want to endure faithfully with a long-view perspective.",
      "I will encourage someone else with a specific promise from this text.",
      "I need to release cynicism and practice expectant hope.",
    ],
  },
  {
    key: "discipleship-mission",
    tags: ["discipleship", "evangelism & mission", "church & community"],
    observations: [
      "This passage shows discipleship as formation for mission, not private growth only.",
      "Following Jesus here includes both learning and going.",
      "Community is portrayed as a witness-bearing people.",
    ],
    questions: [
      "Who is God inviting me to intentionally disciple right now?",
      "Where is fear keeping me from gospel conversations?",
      "How can our community embody this mission more clearly?",
    ],
    applications: [
      "I will pray for one specific person and pursue a spiritual conversation.",
      "I want to practice one visible act of service that points to Jesus.",
      "I should open space for shared mission in my weekly rhythm.",
    ],
  },
  {
    key: "suffering-hope",
    tags: ["suffering & trials", "hope & encouragement", "faith & trust"],
    observations: [
      "The chapter does not dismiss suffering, but reframes it with hope.",
      "Faith is described here as endurance under pressure.",
      "God's nearness in hardship is a repeated theme in this text.",
    ],
    questions: [
      "What trial am I facing that needs renewed trust in God?",
      "Where have I interpreted hardship as abandonment rather than formation?",
      "How can I encourage someone else in their suffering today?",
    ],
    applications: [
      "I will bring this burden to God with honest faith.",
      "I want to practice resilient hope instead of emotional withdrawal.",
      "I should encourage another believer with words rooted in Scripture.",
    ],
  },
  {
    key: "humility-service",
    tags: ["pride & humility", "leadership & service", "church & community"],
    observations: [
      "This chapter defines greatness through humility and service.",
      "The text exposes pride by redirecting attention to others.",
      "Leadership here is measured by sacrificial love.",
    ],
    questions: [
      "Where is pride quietly shaping my relationships?",
      "How can I choose hidden service over recognition this week?",
      "What would humble leadership look like in my current responsibilities?",
    ],
    applications: [
      "I will intentionally serve someone without seeking credit.",
      "I need to repent of self-protection and choose humility.",
      "I want to listen first and lead with gentleness.",
    ],
  },
  {
    key: "family-vocation",
    tags: ["marriage & family", "work & vocation", "money & generosity"],
    observations: [
      "This text brings everyday roles under the lordship of God.",
      "Faithfulness in family and work is portrayed as spiritual worship.",
      "The chapter links stewardship with generosity and trust.",
    ],
    questions: [
      "How can I honor God more faithfully in my daily work?",
      "Where does my household need greater grace and patience?",
      "What does generous stewardship look like in my current season?",
    ],
    applications: [
      "I will do one routine responsibility with intentional worship.",
      "I want to practice generosity in a concrete and measurable way.",
      "I should initiate one restorative conversation at home.",
    ],
  },
  {
    key: "spirit-holiness",
    tags: ["holy spirit", "temptation", "obedience", "faith & trust"],
    observations: [
      "The passage emphasizes dependence on the Spirit for faithful obedience.",
      "Temptation is met here with truth, vigilance, and surrendered trust.",
      "Holiness is shown as Spirit-formed character over time.",
    ],
    questions: [
      "What temptation pattern needs Spirit-enabled resistance today?",
      "Where am I trying to grow spiritually in my own strength?",
      "How can I become more attentive to the Spirit's conviction?",
    ],
    applications: [
      "I will pre-decide one faithful response to a recurring temptation.",
      "I want to pray for the Spirit's help before difficult moments.",
      "I should build accountability into one area where I feel weak.",
    ],
  },
  {
    key: "jesus-identity",
    tags: ["jesus", "salvation & grace", "kingdom of god"],
    observations: [
      "This chapter centers on who Jesus is and what His kingdom brings.",
      "The text reveals Jesus' authority alongside compassion.",
      "The gospel message here confronts both unbelief and self-reliance.",
    ],
    questions: [
      "What response does this passage call me to make toward Jesus?",
      "Where am I admiring Jesus without truly following Him?",
      "How does this chapter expand my understanding of grace?",
    ],
    applications: [
      "I will respond to Jesus with trust, not mere familiarity.",
      "I want to reorder one priority around the values of His kingdom.",
      "I should share one insight about Jesus with a friend this week.",
    ],
  },
];

const GOSPEL_BOOKS = new Set(["Matthew", "Mark", "Luke", "John"]);
const WISDOM_BOOKS = new Set([
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
]);
const PROPHET_BOOKS = new Set([
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
]);
const TORAH_BOOKS = new Set([
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
]);
const LETTER_BOOKS = new Set([
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
]);

function assertDevOnlySeedAllowed(): void {
  const deployment = process.env.CONVEX_DEPLOYMENT;
  if (deployment?.startsWith("prod:")) {
    throw new Error(
      "This seed mutation is dev-only and cannot run on production deployments.",
    );
  }
}

function normalizeTag(rawTag: string): string {
  return rawTag.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 48);
}

function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of rawTags) {
    const tag = normalizeTag(rawTag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne<T>(rng: () => number, items: T[]): T {
  return items[randomInt(rng, 0, items.length - 1)];
}

function sampleWithoutReplacement<T>(
  rng: () => number,
  items: T[],
  count: number,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function buildChapterPool(): ChapterTarget[] {
  const chapters: ChapterTarget[] = [];
  for (const book of BOOKS) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      chapters.push({
        book: book.name,
        chapter,
        testament: book.testament,
      });
    }
  }
  return chapters;
}

function pickThemeKeyForChapter(
  rng: () => number,
  chapter: ChapterTarget,
): ThemeKey {
  if (GOSPEL_BOOKS.has(chapter.book)) {
    return pickOne(rng, [
      "jesus-identity",
      "discipleship-mission",
      "humility-service",
      "suffering-hope",
    ]);
  }
  if (LETTER_BOOKS.has(chapter.book)) {
    return pickOne(rng, [
      "discipleship-mission",
      "spirit-holiness",
      "humility-service",
      "family-vocation",
    ]);
  }
  if (chapter.book === "Acts") {
    return pickOne(rng, [
      "discipleship-mission",
      "spirit-holiness",
      "humility-service",
    ]);
  }
  if (chapter.book === "Revelation") {
    return pickOne(rng, [
      "prophecy-kingdom",
      "suffering-hope",
      "jesus-identity",
    ]);
  }
  if (WISDOM_BOOKS.has(chapter.book)) {
    return pickOne(rng, [
      "wisdom-discernment",
      "prayer-worship",
      "family-vocation",
      "suffering-hope",
    ]);
  }
  if (PROPHET_BOOKS.has(chapter.book)) {
    return pickOne(rng, [
      "prophecy-kingdom",
      "justice-mercy",
      "repentance-grace",
      "covenant-law",
    ]);
  }
  if (TORAH_BOOKS.has(chapter.book)) {
    return pickOne(rng, [
      "covenant-law",
      "repentance-grace",
      "justice-mercy",
      "wisdom-discernment",
    ]);
  }
  if (chapter.testament === "NT") {
    return pickOne(rng, [
      "jesus-identity",
      "discipleship-mission",
      "spirit-holiness",
      "suffering-hope",
    ]);
  }
  return pickOne(rng, [
    "covenant-law",
    "wisdom-discernment",
    "justice-mercy",
    "repentance-grace",
  ]);
}

function getThemeTemplate(themeKey: ThemeKey): ThemeTemplate {
  const direct = THEME_TEMPLATES.find((theme) => theme.key === themeKey);
  if (direct) return direct;
  return THEME_TEMPLATES[0];
}

function buildLogicalTags(rng: () => number, theme: ThemeTemplate): string[] {
  const tags = [...theme.tags];
  const selected = sampleWithoutReplacement(
    rng,
    tags,
    Math.min(tags.length, randomInt(rng, 2, 3)),
  );
  if (rng() < 0.3) {
    selected.push(pickOne(rng, [...STARTER_TAGS]));
  }
  return normalizeTags(selected);
}

function buildLogicalNoteContent(
  rng: () => number,
  chapter: ChapterTarget,
  noteOrdinal: number,
  totalForChapter: number,
  theme: ThemeTemplate,
): string {
  const observation = pickOne(rng, theme.observations);
  const question = pickOne(rng, theme.questions);
  const application = pickOne(rng, theme.applications);
  const focusPrefix = `Study Note ${noteOrdinal}/${totalForChapter} - ${chapter.book} ${chapter.chapter}`;
  return `${focusPrefix}\n\nObservation: ${observation}\nQuestion: ${question}\nApplication: ${application}`;
}

function chapterKey(chapter: ChapterTarget): string {
  return `${chapter.book}:${chapter.chapter}`;
}

function buildVerseAnchorsForChapter(noteCount: number): number[] {
  const minAnchorsNeeded = Math.ceil(noteCount / DEV_MAX_NOTES_PER_VERSE);
  const anchorCount = Math.min(
    DEV_MAX_ANCHOR_VERSES,
    Math.max(DEV_MIN_ANCHOR_VERSES, minAnchorsNeeded),
  );
  return Array.from({ length: anchorCount }, (_, index) => index + 1);
}

function pickBalancedVerseAnchor(
  rng: () => number,
  anchors: number[],
  verseUsage: Map<number, number>,
): number {
  let minUsage = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const usage = verseUsage.get(anchor) ?? 0;
    if (usage < minUsage) {
      minUsage = usage;
    }
  }

  const leastUsedAnchors = anchors.filter(
    (anchor) => (verseUsage.get(anchor) ?? 0) === minUsage,
  );
  return pickOne(rng, leastUsedAnchors);
}

async function upsertStarterTagsInCatalog(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  tags: Set<string>,
  now: number,
): Promise<void> {
  for (const tag of tags) {
    const existing = await ctx.db
      .query("userTags")
      .withIndex("by_userId_tag", (q) => q.eq("userId", userId).eq("tag", tag))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: existing.label || tag,
        source: existing.source === "custom" ? "custom" : "starter",
        updatedAt: now,
        lastUsedAt: now,
      });
      continue;
    }
    await ctx.db.insert("userTags", {
      userId,
      tag,
      label: tag,
      source: "starter",
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    });
  }
}

export const seedDevChapterNotes = mutation({
  args: {
    confirmReplace: v.boolean(),
    chapterCount: v.optional(v.number()),
    heavyChapterCount: v.optional(v.number()),
    baseNotesPerChapter: v.optional(v.number()),
    heavyNotesPerChapter: v.optional(v.number()),
    seed: v.optional(v.number()),
  },
  returns: v.object({
    seed: v.number(),
    selectedChapters: v.number(),
    heavyChapters: v.number(),
    notesCreated: v.number(),
    verseRefsCreated: v.number(),
    linksCreated: v.number(),
    testamentDistribution: v.object({
      ot: v.number(),
      nt: v.number(),
    }),
    cleanup: v.object({
      notesDeleted: v.number(),
      linksDeleted: v.number(),
      verseRefsDeleted: v.number(),
    }),
    usedTags: v.array(v.string()),
    chapterSummaries: v.array(
      v.object({
        book: v.string(),
        chapter: v.number(),
        testament: v.union(v.literal("OT"), v.literal("NT")),
        isHeavy: v.boolean(),
        noteCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    assertDevOnlySeedAllowed();
    if (!args.confirmReplace) {
      throw new Error(
        "Set confirmReplace=true to acknowledge replacing your existing note data.",
      );
    }

    const userId = await getCurrentUserId(ctx);
    const seed = clampInteger(
      args.seed,
      1,
      Number.MAX_SAFE_INTEGER,
      Date.now(),
    );
    const chapterCount = clampInteger(
      args.chapterCount,
      2,
      120,
      DEV_DEFAULT_CHAPTER_COUNT,
    );
    const heavyChapterCount = clampInteger(
      args.heavyChapterCount,
      1,
      chapterCount,
      DEV_DEFAULT_HEAVY_CHAPTER_COUNT,
    );
    const baseNotesPerChapter = clampInteger(
      args.baseNotesPerChapter,
      1,
      50,
      DEV_DEFAULT_BASE_NOTES,
    );
    const heavyNotesPerChapter = clampInteger(
      args.heavyNotesPerChapter,
      2,
      120,
      DEV_DEFAULT_HEAVY_NOTES,
    );
    const rng = createRng(seed);
    const now = Date.now();

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    let linksDeleted = 0;
    let notesDeleted = 0;
    let verseRefsDeleted = 0;
    const referencedVerseRefIds = new Set<Id<"verseRefs">>();

    for (const note of notes) {
      const links = await ctx.db
        .query("noteVerseLinks")
        .withIndex("by_noteId", (q) => q.eq("noteId", note._id))
        .collect();
      for (const link of links) {
        referencedVerseRefIds.add(link.verseRefId);
        await ctx.db.delete(link._id);
        linksDeleted += 1;
      }
      await ctx.db.delete(note._id);
      notesDeleted += 1;
    }

    for (const verseRefId of referencedVerseRefIds) {
      const ref = await ctx.db.get(verseRefId);
      if (!ref || ref.userId !== userId) continue;

      const stillLinkedToNote = await ctx.db
        .query("noteVerseLinks")
        .withIndex("by_verseRefId", (q) => q.eq("verseRefId", verseRefId))
        .first();
      if (stillLinkedToNote) continue;

      const stillLinkedPrimary = await ctx.db
        .query("verseLinks")
        .withIndex("by_verseRefId1", (q) => q.eq("verseRefId1", verseRefId))
        .first();
      if (stillLinkedPrimary) continue;

      const stillLinkedSecondary = await ctx.db
        .query("verseLinks")
        .withIndex("by_verseRefId2", (q) => q.eq("verseRefId2", verseRefId))
        .first();
      if (stillLinkedSecondary) continue;

      await ctx.db.delete(verseRefId);
      verseRefsDeleted += 1;
    }

    const pool = buildChapterPool();
    const otPool = pool.filter((chapter) => chapter.testament === "OT");
    const ntPool = pool.filter((chapter) => chapter.testament === "NT");
    const targetOtChapters = clampInteger(
      Math.round(
        (chapterCount * DEV_DEFAULT_OT_CHAPTERS) / DEV_DEFAULT_CHAPTER_COUNT,
      ),
      1,
      chapterCount - 1,
      DEV_DEFAULT_OT_CHAPTERS,
    );
    const targetNtChapters = chapterCount - targetOtChapters;

    const selectedOt = sampleWithoutReplacement(
      rng,
      otPool,
      Math.min(targetOtChapters, otPool.length),
    );
    const selectedNt = sampleWithoutReplacement(
      rng,
      ntPool,
      Math.min(targetNtChapters, ntPool.length),
    );
    const selectedChapters = sampleWithoutReplacement(
      rng,
      [...selectedOt, ...selectedNt],
      chapterCount,
    );
    const heavyChapterKeys = new Set(
      sampleWithoutReplacement(rng, selectedChapters, heavyChapterCount).map(
        (chapter) => chapterKey(chapter),
      ),
    );

    const verseRefCache = new Map<string, Id<"verseRefs">>();
    let notesCreated = 0;
    let linksCreated = 0;
    let verseRefsCreated = 0;
    const usedTags = new Set<string>();
    const chapterSummaries: Array<{
      book: string;
      chapter: number;
      testament: Testament;
      isHeavy: boolean;
      noteCount: number;
    }> = [];

    for (const chapter of selectedChapters) {
      const isHeavy = heavyChapterKeys.has(chapterKey(chapter));
      const noteCount = isHeavy ? heavyNotesPerChapter : baseNotesPerChapter;
      const verseAnchors = buildVerseAnchorsForChapter(noteCount);
      const verseUsage = new Map<number, number>(
        verseAnchors.map((anchor) => [anchor, 0]),
      );
      chapterSummaries.push({
        book: chapter.book,
        chapter: chapter.chapter,
        testament: chapter.testament,
        isHeavy,
        noteCount,
      });

      for (let index = 1; index <= noteCount; index += 1) {
        const themeKey = pickThemeKeyForChapter(rng, chapter);
        const theme = getThemeTemplate(themeKey);
        const tags = buildLogicalTags(rng, theme);
        for (const tag of tags) {
          usedTags.add(tag);
        }

        const content = buildLogicalNoteContent(
          rng,
          chapter,
          index,
          noteCount,
          theme,
        );
        const noteId = await ctx.db.insert("notes", {
          userId,
          content,
          tags,
          createdAt: now,
          updatedAt: now,
        });
        notesCreated += 1;

        const startVerse = pickBalancedVerseAnchor(
          rng,
          verseAnchors,
          verseUsage,
        );
        verseUsage.set(startVerse, (verseUsage.get(startVerse) ?? 0) + 1);
        const endVerse = startVerse;
        const verseRefKey = `${chapter.book}:${chapter.chapter}:${startVerse}:${endVerse}`;
        let verseRefId = verseRefCache.get(verseRefKey);
        if (!verseRefId) {
          const existingRef = await ctx.db
            .query("verseRefs")
            .withIndex("by_userId_book_chapter_verses", (q) =>
              q
                .eq("userId", userId)
                .eq("book", chapter.book)
                .eq("chapter", chapter.chapter)
                .eq("startVerse", startVerse)
                .eq("endVerse", endVerse),
            )
            .first();
          if (existingRef) {
            verseRefId = existingRef._id;
          } else {
            verseRefId = await ctx.db.insert("verseRefs", {
              userId,
              book: chapter.book,
              chapter: chapter.chapter,
              startVerse,
              endVerse,
            });
            verseRefsCreated += 1;
          }
          verseRefCache.set(verseRefKey, verseRefId);
        }

        await ctx.db.insert("noteVerseLinks", {
          userId,
          noteId,
          verseRefId,
        });
        linksCreated += 1;
      }
    }

    await upsertStarterTagsInCatalog(ctx, userId, usedTags, now);

    const otSelected = chapterSummaries.filter(
      (chapter) => chapter.testament === "OT",
    ).length;
    const ntSelected = chapterSummaries.filter(
      (chapter) => chapter.testament === "NT",
    ).length;

    return {
      seed,
      selectedChapters: chapterSummaries.length,
      heavyChapters: chapterSummaries.filter((chapter) => chapter.isHeavy)
        .length,
      notesCreated,
      verseRefsCreated,
      linksCreated,
      testamentDistribution: {
        ot: otSelected,
        nt: ntSelected,
      },
      cleanup: {
        notesDeleted,
        linksDeleted,
        verseRefsDeleted,
      },
      usedTags: Array.from(usedTags).sort(),
      chapterSummaries: chapterSummaries.sort((a, b) => {
        if (a.book === b.book) return a.chapter - b.chapter;
        return a.book.localeCompare(b.book);
      }),
    };
  },
});
