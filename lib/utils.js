import axios from "axios"
import { load } from "cheerio"
import { resolve } from "url"

const LAROUSSE_URL = "https://www.larousse.fr/"
const DICTIONNARY_URL = "https://www.larousse.fr/dictionnaires/francais/"

/**
 * Get the HTML page of a word in the Larousse dictionnary.
 * @param {string} word - a French word that actually exists or not.
 * @return {AxiosResponse<any,any>} A AxiosResponse to get the word's HTML page.
 */
const getPage = async (word) => {
    const url = resolve(DICTIONNARY_URL, word)
    let response
    try {
        response = await axios.get(url)
    } catch (error) {
        const message = `Failed to fetch page ${url}, server responded with ${error.response.status}`
        throw new Error(message, {cause: error})
    }
    return response
}

/**
 * Get the word that is subject of the page from its URL.
 * @param {string} url - The URL of a word that actually exists or not in the Larousse dictionnary.
 * @return {string} The word that is subject of the page.
 */
const getWord = (url) => {
    const word = url.split("/")[url.split("/").length - 2]
    if (word == undefined)
        throw new Error(`Invalid argument : failed to get word from url "${url}".`)
    return word
}

/**
 * Get suggestions of words from the Larousse dictionnary.
 * @param {string} content - The HTML content of a page of the Larousse dictionnary.
 * @param {boolean} exist - Does the word concerned by the page really exist or not?
 * @return {Array<{word: string, url: string}>} The list of word suggestions.
 */
const getSuggestions = (content, exist) => {
    const suggestions = []
    const selector = exist ?
        ".wrapper-search > article:not(.sel) ~ .banner-title > .item-result > a" +
        ", .wrapper-search > section:not(.banner-title ~ section) > article:not(.sel, .sous-article) > .item-result > a"
        : ".corrector > ul > li > h3 > a"
    content(selector).each((_, elem) => {
        const suggestion = {
            word: elem.children[0].data.trim(),
            url: resolve(LAROUSSE_URL, elem.attribs.href)
        }
        suggestions.push(suggestion)
    })
    return suggestions
}

/**
 * Get the grammatical category of a word from the Larousse dictionnary.
 * @param {string} content - The HTML content of a page of the Larousse dictionnary.
 * @return {string} The grammatical category of the word.
 */
const getGramCat = (content) => {
    const gramCat = content(".Zone-Entree1 > .CatgramDefinition")[0].children[0].data.trim()
    return gramCat
}

/**
 * Get the spellings of a word from how it is classified for pronunciation in the Larousse dictionary.
 * @param {string} content - The HTML content of a page of the Larousse dictionnary.
 * @return {Array<Array<string>>} A list including each writing list corresponding to a pronunciation.
 */
const getWords = (content) => {
    const words = []
    content(".Zone-Entree1 > h2").each((_, wordsCats) => {
        const wordsCat = []
        wordsCats.children.forEach((child) => {
            if (child.type == "text" && !child.data.includes("\n"))
                child.data.trim().split(", ").forEach((word) => wordsCat.push(word))
        })
        words.push(wordsCat)
    })
    return words
}

/**
 * Get the origin of a word from the Larousse dictionary.
 * @param {string} content - The HTML content of a page of the Larousse dictionnary.
 * @return {string} The origin of the word.
 */
const getOrigin = (content) => {
    let origin = ""
    const originContent = content(".Zone-Entree1 > .OrigineDefinition")
    if (originContent.length > 0)
        content(".Zone-Entree1 > .OrigineDefinition")[0].children.forEach((child) => {
            if (child.type == "text")
                origin += child.data.replace(/\(|\)/g, "")
            else if (child.type == "tag") {
                if (child.children[0].type == "tag")
                    origin += child.children[0].children[0].data.replace(/\(|\)/g, "")
                else
                    origin += child.children[0].data.replace(/\(|\)/g, "")
            }
        });
    origin = origin.trim()
    return origin
}

/**
 * Get the list of all the definitions of a word from the Larousse dictionary.
 * @param {string} content - The HTML content of a page of the Larousse dictionnary.
 * @return {Array<{num: number, definition: string, examples: Array<string>, synonyms: Array<{word: string,
 *  url: string, info: string}>, antonyms: Array<{word: string, url: string, info: string}>}>} The list of suggestions.
 */
const getDefinitionsList = (content) => {
    const list = []
    content(".Definitions:first-of-type > .DivisionDefinition").each((_, defContent) => {
        const definition = getDefinition(defContent)
        list.push(definition)
    })
    return list
}

/**
 * Get a definition from the Larousse dictionary.
 * @param {string} content - The HTML content of the first div with class "DivisionDefinition" on the Larousse dictionnary.
 * @return {{num: number, definition: string, examples: Array<string>, synonyms: Array<{word: string, url: string, info: string}>,
 *  antonyms: Array<{word: string, url: string, info: string}}} The definition.
 */
const getDefinition = (defContent) => {
    let definition = {
        num: null,
        definition: "",
        examples: [],
        synonyms: [],
        antonyms: []
    }
    defContent.children.forEach((child) => {
        if (child.type == "text" && !child.data.includes("\n") && child.data.trim() != "")
            definition.definition += child.data
        else if (child.type == "tag") {
            if (child.attribs.class == "numDef")
                definition.num = child.children[0].data.trim().split(".")[0]
            else if (child.attribs.class == "Renvois")
                definition.definition += child.children[0].children[0].data.trim()
            else if (child.attribs.class == "ExempleDefinition")
                definition.examples.push(child.children[0].data.trim())
            else if (child.attribs.class == "Synonymes") { // Synonyms and antonyms both use the "Synonyms" class
                const onyms = getDefinitionOnyms(child)
                definition[onyms.type] = onyms.list
            }
        }
    })
    definition.definition = definition.definition.replace("\u00a0:", "").trim()
    return definition
}

/**
 * Get the synonyms or antonyms of a definition from the Larousse dictionary.
 * @param {string} content - The HTML content of div with class "Synonyms" on the Larousse dictionnary.
 * @return {{type: string, list: Array<{word: string, url: string, info: string}>}} The type (synonyms/antonyms) and the list.
 */
const getDefinitionOnyms = (onymContent) => {
    const onyms = {
        type: "",
        list: []
    }
    onyms.type = ["Synonyme :", "Synonymes :"].includes(onymContent.prev.prev.children[0].data) ? "synonyms" : "antonyms"
    onymContent.children.forEach((childOnyms) => {
        if (childOnyms.type == "text" && childOnyms.data != " - ")
            onyms.list = onyms.list.concat(getTextOnyms(childOnyms))
        else if (childOnyms.type == "tag" && childOnyms.attribs.class == "Renvois") {
            const onym = {
                word: childOnyms.children[0].children[0].data,
                url: resolve(LAROUSSE_URL,childOnyms.children[0].attribs.href)
            }
            onyms.list.push(onym)
        }
    })
    return onyms
}

/**
 * Get the synonyms or antonyms from a text part of a definition from the Larousse dictionary.
 * @param {Cheerio.Text} onymsTextElem - The text Cheerio (domhandler?) element to parse from a definition on the
 *  Larousse dictionnary, data example : "- beau - joli".
 * @return {Array<{word: string, info: string}>} The list of synonyms or antonyms.
 */
const getTextOnyms = (onymsTextElem) => {
    const onyms = []
    const onymsTextList = onymsTextElem.data.split(" - ")
    onymsTextList.forEach((word) => {
        const onym = {}
        if (word != "") {
            onym.word = word.trim()
            if (word == onymsTextList[onymsTextList.length - 1] && onymsTextElem.next)
                if (onymsTextElem.next.type == "tag" && onymsTextElem.next.attribs.class == "indicateurDefinition") 
                    onym.info = onymsTextElem.next.children[0].data.replace(/\(|\)/g, "").trim()
            onyms.push(onym)
        }
    })
    return onyms
}

/**
 * Get the definitions from the Larousse dictionary.
 * @param {string} content - The HTML content of a page of the Larousse dictionnary.
 * @return {{words: Array<Array<string>>, gramCat: string, origin: string, list: Array<{num: number, definition: string, 
 *  examples: Array<string>,Synonyms: Array<{word: string, url: string, info: string}>,antonyms: Array<{word: string,
 *  url: string, info: string}>}>}} The definitions.
 */
const getDefinitions = (content) => {
    const definitions = {
        words: getWords(content),
        gramCat: getGramCat(content),
        origin: getOrigin(content),
        list: getDefinitionsList(content)
    }
    return definitions
}

/**
 * Get all the data on a word from the Larousse dictionary.
 * @param {string} word - The word, whether it actually exists or not.
 * @return {Promise<{find: boolean, word: string, url: string, definitions: {words: Array<Array<string>>, gramCat: string,
 *  origin: string, list: Array<{num: number, definition: string, examples: Array<string>,
 *  synonyms: Array<{word: string, url: string, info: string}>, antonyms: Array<{word: string, url: string, info: string}>}>},
 *  suggestions: Array<{word: string, url: string}>}>} The data on the word.
 */
const search = async (word) => {
    try {
        const page = await getPage(word)
        const content = load(page.data)
        const url = page.request.res.responseUrl
        const find = url.endsWith(word) ? false : true
        const wordFind = find ? getWord(url) : word
        const definitions = find ? getDefinitions(content) : {}
        const suggestions = getSuggestions(content, find)

        const response = {
            find: find,
            word: wordFind,
            url: url,
            definitions: definitions,
            suggestions: suggestions,
        }

        return response
    } catch (error) {
        const message = `Failed to get data for word "${word}" : the larousse website may be unavailable or modified.`
        throw new Error(message, { cause: error })
    }
}

export default { search }