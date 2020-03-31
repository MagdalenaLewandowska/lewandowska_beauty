var remark = require("remark")
var recommended = require("remark-preset-lint-recommended")
var html = require("remark-html")
const fs = require("fs-extra")

const markdownToHTML = (markdown) => {
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
  compare({ left, right, note }) {
    const template = fs
      .readFileSync("src/templates/components/compare.html")
      .toString()

    return template
      .replace("{{left}}", left)
      .replace("{{right}}", right)
      .replace("{{note}}", note)
  },
}

const insertSpecialComponents = (markdown) => {
  const lines = markdown.split("\n")
  const output = []

  let componentData = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.match(/^```[a-z]+$/i)) {
      componentData = {}
      componentData.name = trimmed.slice(3).toLowerCase()
      componentData.props = {}
    } else if (trimmed.match(/^```$/i)) {
      const transformed = specialTags[componentData.name](componentData.props)

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

const render = async (fullName) => {
  const [fileName, extension] = fullName.split(".")
  const outputFolder = fileName === "index" ? "public" : `public/${fileName}`
  const page = fs.readFileSync(`src/pages/${fullName}`).toString()
  const lines = page.split("\n")

  const options = Object.fromEntries(
    lines.slice(1, 3).map((option) => option.split(":").map((x) => x.trim())),
  )
  const body = lines.slice(4).join("\n")

  const content = await markdownToHTML(insertSpecialComponents(body))

  const rendered = fs
    .readFileSync(`src/templates/layouts/${options.layout}.html`)
    .toString()
    .replace("{{pageTitle}}", options.title)
    .replace("{{content}}", content)

  fs.ensureDirSync(outputFolder)
  fs.writeFileSync(`${outputFolder}/index.html`, rendered)
}

const main = async () => {
  const pages = fs.readdirSync("src/pages")

  for (const page of pages) {
    await render(page)
  }
}

main()
