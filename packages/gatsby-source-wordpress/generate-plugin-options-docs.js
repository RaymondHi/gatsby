const prettier = require(`prettier`)
const Joi = require(`@hapi/joi`)
const Handlebars = require(`handlebars`)
const fs = require(`fs-extra`)
const _ = require(`lodash`)
const toc = require(`markdown-toc`)
const prettierConfig = require(`../../.prettierrc.js`)

const {
  pluginOptionsSchema,
} = require(`./src/steps/declare-plugin-options-schema`)

/**
 * This script generates ./docs/plugin-options.md from the plugin options schema.
 * ./docs/plugin-options.md should never be edited directly since it's auto-generated. Update ./src/steps/declare-plugin-options-schema.ts instead
 */

// :( poor children
const excludeParentsChildren = [`RootQuery`]
/**
 * Takes the keys from a Joi schema and recursively
 * turns the nested keys into structured markdown documentation
 *
 * @param {object} keys
 * @param {string} mdString
 * @param {number} level
 * @param {string} parent
 */
function joiKeysToMD({
  keys,
  mdString = ``,
  level = 1,
  parent = null,
  parentMetas = [],
}) {
  if (
    !keys ||
    (parentMetas.length && parentMetas.find(meta => meta.portableOptions))
  ) {
    return mdString
  }

  Object.entries(keys).forEach(([key, value]) => {
    const isRequired = value.flags && value.flags.presence === `required`

    const title = `${parent ? `${parent}.` : ``}${key}${
      isRequired ? ` (**required**)` : ``
    }`

    mdString += `${`#`.repeat(level + 1)} ${title}`

    if (value.description) {
      mdString += `\n\n`
      const description = value.description.trim()
      mdString += description.endsWith(`.`) ? description : `${description}.`
    }

    if (value.type) {
      const { trueType } =
        (value.meta && value.meta.find(meta => `trueType` in meta)) || {}

      mdString += `\n\n`
      mdString += `**Field type**: \`${(trueType || value.type)
        .split(`|`)
        .map(typename => _.startCase(typename))
        .join(` | `)}\``
    }

    if (
      (value.flags && `default` in value.flags) ||
      (value.meta && value.meta.find(meta => `default` in meta))
    ) {
      const defaultValue =
        (value.meta.find(meta => `default` in meta) || {}).default ||
        value.flags.default

      let printedValue

      if (typeof defaultValue === `string`) {
        printedValue = defaultValue
      } else if (Array.isArray(defaultValue)) {
        printedValue = `[${defaultValue.join(`, `)}]`
      } else if (
        [`boolean`, `function`, `number`].includes(typeof defaultValue)
      ) {
        printedValue = defaultValue.toString()
      } else if (defaultValue === null) {
        printedValue = `null`
      }

      if (typeof printedValue === `string`) {
        mdString += `\n\n`
        mdString += `**Default value**: ${
          printedValue.includes(`\n`)
            ? `\n\`\`\`js\n${printedValue}\n\`\`\``
            : `\`${printedValue}\``
        }`
      }
    }

    if (value.meta) {
      const examples = value.meta.filter(meta => `example` in meta)
      examples.forEach(({ example }) => {
        mdString += `\n\n\`\`\`js\n` + example + `\n\`\`\`\n`
      })
    }

    mdString += `\n\n`

    const excludeChildren = excludeParentsChildren.includes(key)

    if (!excludeChildren && value.children) {
      mdString = joiKeysToMD({
        keys: value.children,
        mdString,
        level: level + 1,
        parent: title,
        parentMetas: value.meta,
      })
    }

    if (!excludeChildren && value.items && value.items.length) {
      value.items.forEach(item => {
        if (item.children) {
          mdString = joiKeysToMD({
            keys: item.children,
            mdString,
            level: level + 1,
            parent: title + `[]`,
            parentMetas: value.meta,
          })
        }
      })
    }
  })

  return mdString
}

/**
 * Converts the Joi schema description into markdown
 * and writes it to the filesystem
 *
 * @param {object} description
 */
async function generateMdStringFromSchemaDescription(description) {
  const template = Handlebars.compile(`# Plugin Options

[comment]: # (This file is automatically generated. Do not edit it directly. Instead, edit the Joi schema in ./plugin/src/steps/declare-plugin-options-schema.js)
{{{tableOfContents}}}
{{{docs}}}

# Up Next :point_right:

- :boat: [Migrating from other WP source plugins](./migrating-from-other-wp-source-plugins.md)
- :house: [Hosting WordPress](./hosting.md)
- :athletic_shoe: [Themes, Starters, and Examples](./themes-starters-examples.md)
- :medal_sports: [Usage with popular WPGraphQL extensions](./usage-with-popular-wp-graphql-extensions.md)
- :hammer_and_wrench: [Debugging and troubleshooting](./debugging-and-troubleshooting.md)
- :national_park: [Community and Support](./community-and-support.md)
- :point_left: [Back to README.md](../README.md)`)

  const docs = joiKeysToMD({
    keys: description.children,
  })
  const tableOfContents = toc(docs).content

  const mdContents = template({
    tableOfContents,
    docs,
  })

  const mdStringFormatted = prettier.format(mdContents, {
    parser: `markdown`,
    ...prettierConfig,
  })

  return mdStringFormatted
}

async function getPluginOptionsMdString() {
  const description = pluginOptionsSchema({ Joi }).describe()
  const mdString = generateMdStringFromSchemaDescription(description)
  return mdString
}

async function writePluginOptionsMdFile() {
  console.info(`writing out plugin options schema docs to plugin-options.md`)
  const mdString = await getPluginOptionsMdString()
  await fs.writeFile(`./docs/plugin-options.md`, mdString)
}

if (process.env.NODE_ENV !== `test`) {
  writePluginOptionsMdFile()
}

module.exports = { getPluginOptionsMdString }
