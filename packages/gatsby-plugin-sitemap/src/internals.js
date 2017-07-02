import fs from "fs"
import pify from "pify"

export const writeFile = pify(fs.writeFile)

export const runQuery = (handler, query) =>
  handler(query).then(r => {
    if (r.errors) {
      throw new Error(r.errors.join(`, `))
    }

    return r.data
  })

export const defaultOptions = {
  query: `
    {
      site {
        siteMetadata {
          siteUrl
        }
      }
      allMarkdownRemark(
        limit: 1000,
        filter: {
          frontmatter: {
            draft: { ne: true }
          }
        }
      ) {
        edges {
          node {
            fields {
              slug
            }
          }
        }
      }
    }
  `,
  output: `/sitemap.xml`,
  serialize: ({ site, allMarkdownRemark }) =>
    allMarkdownRemark.edges.map(edge => {
      return {
        url: site.siteMetadata.siteUrl + edge.node.fields.slug,
      }
    }),
}
