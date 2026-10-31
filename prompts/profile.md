You are building a voice profile for a tool that drafts X posts in the voice of a named person. A human reviews every draft before it is posted. The profile is the only thing that tells the drafting model how this person sounds, so a vague or generic profile produces generic posts, and generic posts are worthless here.

Work only from the writing supplied. Do not use anything you may know about the author from elsewhere, and do not guess at traits the text does not show.

The profile describes how the author writes: traits that would still hold if they wrote about a subject they have never covered. It must not summarise what the articles say. Name a theme as a kind of preoccupation, never as an account of a particular piece. Be specific enough that each trait could be checked against the text, and quote a few words where that makes a trait concrete.

=====

Author: {{display_name}} (@{{handle}})

<articles>
{{corpus}}
</articles>

<x_samples>
{{x_samples}}
</x_samples>

Notes on the material:
- Lines that start with ">" are block quotes or pull quotes. Some are the author's own emphasis and some are another person's words. Do not treat an attributed quotation as the author's voice.
- x_samples are past X posts by the author, one per line. When any are present they are the primary evidence for x_translation and outweigh the long-form articles for that field. When none are present, infer x_translation from the long-form writing alone.

Fill the profile fields as follows.

identity: who is speaking and where they stand when they look at the world. The position they write from, their relationship to the reader, their point of view. Two to four sentences.

themes: recurring preoccupations, each a short phrase.

stance: believes holds the convictions the writing keeps returning to. pushes_against holds what it argues with or refuses.

diction: uses holds characteristic words, phrasings and constructions that are actually present in the text. never_uses holds kinds of words and registers that are conspicuously absent across the whole corpus.

rhythm: sentence length and how it varies, fragments, paragraphing, capitalisation habits, and punctuation habits such as ellipses, parentheses, dashes, question marks and quotation marks used for emphasis.

uses_emoji: true only if emoji appear in the author's own text.

humour: the kind of humour, if any, and the overall register.

openings and closings: the recurring ways pieces begin and end, described as patterns.

do_not: moves that would at once make a draft sound unlike this author.

x_translation: how this voice behaves in a single post of at most 280 characters. survives holds the traits that carry over intact. cut holds what has to go.

exemplars: 16 candidate sentences, best first. The tool keeps the first 10 it can find, character for character, in the article at the url you give, so copy each one exactly: the same quotation marks, apostrophes, capitalisation and spelling, including any mistakes. Each is a single sentence, or a single line of verse, of at most 280 characters. Favour sentences that show the voice at its most recognisable over ones that carry information. Draw them from at least six different articles. Never take one from a line that starts with ">", from a heading, or from a list label. If there are no articles, return an empty list.
