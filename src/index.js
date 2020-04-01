var remark = require("remark")
var recommended = require("remark-preset-lint-recommended")
var html = require("remark-html")
const fs = require("fs-extra")

const markdownToHTML = markdown => {
  return new Promise((resolve, reject) => {
    remark()
      .use(recommended)
      .use(html)
      .process(markdown, function(err, file) {
        if (err) {
          reject(err)
        } else {
          resolve(file)
        }
      })
  })
}

const specialTags = {
  compare({ left, right, note }, isEnglish = false) {
    const template = fs
      .readFileSync("src/templates/components/compare.html")
      .toString()

    const before = isEnglish ? "BEFORE" : "PRZED"
    const after = isEnglish ? "AFTER" : "PO"

    return template
      .replace("{{left}}", left)
      .replace("{{right}}", right)
      .replace("{{note}}", note)
      .replace("{{before}}", before)
      .replace("{{after}}", after)
  },

  social({ name, image, url }) {
    const template = fs
      .readFileSync("src/templates/components/social.html")
      .toString()

    return template
      .replace("{{name}}", name)
      .replace("{{image}}", image)
      .replace("{{url}}", url)
  },
}

const insertSpecialComponents = (markdown, isEnglish) => {
  const lines = markdown.split("\n")
  const output = []

  let componentData = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.match(/^\+\+\+[a-z]+$/i)) {
      componentData = {}
      componentData.name = trimmed.slice(3).toLowerCase()
      componentData.props = {}
    } else if (trimmed.match(/^\+\+\+$/i)) {
      const transformed = specialTags[componentData.name](
        componentData.props,
        isEnglish
      )

      output.push(transformed)

      componentData = null
    } else if (componentData) {
      const separatorIndex = trimmed.indexOf(":")
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim()

      componentData.props[key] = value
    } else {
      output.push(line)
    }
  }

  return output.join("\n")
}

const getPages = () => {
  return fs
    .readdirSync("src/pages")
    .filter(name => name !== "components")
    .map(fullName => {
      const [fileName] = fullName.split(".")
      const isEnglish = fullName.includes(".en.")

      const outputFolder = isEnglish
        ? fileName === "index"
          ? "public/en/"
          : `public/en/${fileName}`
        : fileName === "index"
        ? "public"
        : `public/${fileName}`

      const page = fs.readFileSync(`src/pages/${fullName}`).toString()
      const lines = page.split("\n")

      const options = Object.fromEntries(
        lines.slice(1, 4).map(option => option.split(":").map(x => x.trim()))
      )
      const body = lines.slice(5).join("\n")

      return { options, body, outputFolder, fileName, isEnglish }
    })
}

const getLinksData = (pages, english = false) => {
  return pages
    .filter(
      page => Number(page.options.menu) !== 0 && page.isEnglish === english
    )
    .sort((a, b) => a.options.menu - b.options.menu)
    .map(page => ({
      link: page.isEnglish
        ? page.fileName === "index"
          ? "en"
          : `en/${page.fileName}`
        : page.fileName === "index"
        ? ""
        : page.fileName,
      title: page.options.title,
    }))
}

const renderLinks = linksData => {
  const linksTemplate = fs
    .readFileSync("src/templates/components/menu-link.html")
    .toString()

  return linksData
    .map(({ link, title }) =>
      linksTemplate.replace("{{link}}", `/${link}`).replace("{{title}}", title)
    )
    .join("\n")
}

const renderSocial = () => {
  const markdown = fs.readFileSync("src/pages/components/social.md").toString()

  return insertSpecialComponents(markdown)
}

const render = async ({ options, body, outputFolder, isEnglish }, links) => {
  const withSpecialComponents = insertSpecialComponents(body, isEnglish)
  const content = await markdownToHTML(withSpecialComponents)
  const social = renderSocial()

  const rendered = fs
    .readFileSync(`src/templates/layouts/${options.layout}.html`)
    .toString()
    .replace("{{pageTitle}}", options.title)
    .replace("{{content}}", content)
    .replace("{{links}}", links)
    .replace("{{social}}", social)
    .replace("{{homeUrl}}", isEnglish ? "/en" : "/")

  fs.ensureDirSync(outputFolder)
  fs.writeFileSync(`${outputFolder}/index.html`, rendered)
}

const main = async () => {
  const pages = getPages()
  const links = renderLinks(getLinksData(pages))
  const linksEnglish = renderLinks(getLinksData(pages, true))

  for (const page of pages) {
    if (page.isEnglish) {
      await render(page, linksEnglish)
    } else {
      await render(page, links)
    }
  }
}

main()
