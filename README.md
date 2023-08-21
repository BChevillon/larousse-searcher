
---

# Larousse Searcher

A Node.js module for searching words in the Larousse dictionary. Retrieve origin, definitions, synonyms, antonyms, and more for French words.

## Installation

Install the package using npm:

```bash
npm install larousse-searcher
```

## Usage

### Example: Search Word in Larousse Dictionary

```javascript
import larousseSearcher from "larousse-searcher"

async function main() {
  try {
    const word = 'dormir' // The word you want to search for
    const result = await larousseSearcher.search(word)

    if (result.find) {
      console.log(`Word "${result.word}" corresponds to the found page.`)
      console.log(`Grammatical Category: ${result.definitions.gramCat}`)
      console.log(`Origin: ${result.definitions.origin}`)
      console.log('Definitions:')
      result.definitions.list.forEach((definition) => {
        console.log(`- Definition ${definition.num}: ${definition.definition}`)
        console.log('  Examples:', definition.examples)
        console.log('  Synonyms:', definition.synonyms.map(synonym => synonym.word))
        console.log('  Antonyms:', definition.antonyms.map(antonym => antonym.word))
      })
    } else {
      console.log(`Word "${result.word}" was not found in the Larousse dictionary.`)
      console.log('Suggestions:')
      result.suggestions.forEach((suggestion) => {
        console.log(`- ${suggestion.word}`)
      })
    }
  } catch (error) {
    console.error('An error occurred:', error.message)
  }
}

main()
```

### Search Result Structure

The `search` function returns an object with the following structure:

```javascript
{
  find: boolean,        // Whether the word was found in the dictionary
  word: string,         // The word that corresponds to the found page
  url: string,          // URL of the Larousse page for the word
  definitions: {
    words: Array<Array<string>>, // Lists of words corresponding to different pronunciations
    gramCat: string,     // Grammatical category of the word
    origin: string,      // Origin of the word
    list: Array<{
      num: number,       // Definition number
      definition: string,// Definition content
      examples: Array<string>, // Examples of usage
      synonyms: Array<{word: string, url: string, info: string}>, // Synonyms
      antonyms: Array<{word: string, url: string, info: string}>   // Antonyms
    }>
  },
  suggestions: Array<{word: string, url: string}> // Word suggestions if the word is not found
}
```

## Creator

This module was created by Benoit CHEVILLON. If you have any questions or feedback, you can reach out via email at benoit.chevillon6@gmail.com.

## License

This project is licensed under the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

---