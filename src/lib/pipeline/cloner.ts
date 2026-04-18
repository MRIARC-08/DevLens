import fs from 'fs'
import path from 'path'
import https from 'https'

export async function cloneRepository(
  repoUrl: string,
  repoId: string
): Promise<string> {
  const base = process.env.CLONE_BASE_PATH || '/tmp/devlens'
  const clonePath = path.join(base, repoId)

  console.log(`[cloner] Starting download of ${repoUrl} → ${clonePath}`)

  // Extract owner and repo from URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) {
    throw new Error('Invalid GitHub URL format')
  }

  const owner = match[1]
  const repo = match[2].replace('.git', '')

  try {
    fs.mkdirSync(clonePath, { recursive: true })

    // Use GitHub API to get the default branch
    const repoInfo = await fetchJSON(
      `https://api.github.com/repos/${owner}/${repo}`,
      process.env.GITHUB_TOKEN
    )

    const branch = repoInfo.default_branch || 'main'

    // Get the file tree recursively from GitHub API
    const treeData = await fetchJSON(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      process.env.GITHUB_TOKEN
    )

    if (!treeData.tree) {
      throw new Error('Could not fetch repository file tree')
    }

    // Filter to only JS/TS files, skip large files and noise
    const skipDirs = [
      'node_modules', '.git', '.next', 'dist',
      'build', 'out', 'coverage', '.turbo', '.cache'
    ]
    const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']

    const filesToDownload = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false
      if (item.size > 100 * 1024) return false // skip files > 100KB

      const filePath: string = item.path
      const ext = path.extname(filePath)

      // Skip noise patterns
      if (filePath.includes('.min.')) return false
      if (filePath.includes('.bundle.')) return false
      if (filePath.includes('.generated.')) return false

      // Skip blacklisted directories
      const parts = filePath.split('/')
      for (const part of parts) {
        if (skipDirs.includes(part)) return false
      }

      return validExtensions.includes(ext)
    }).slice(0, 200) // cap at 200 files

    console.log(`[cloner] Found ${filesToDownload.length} files to download`)

    // Download each file content
    for (const file of filesToDownload) {
      const fileContent = await fetchRaw(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`,
        process.env.GITHUB_TOKEN
      )

      const fullPath = path.join(clonePath, file.path)
      const dir = path.dirname(fullPath)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(fullPath, fileContent, 'utf8')
    }

    console.log(`[cloner] ✓ Download complete: ${clonePath}`)
    return clonePath

  } catch (error) {
    try {
      fs.rmSync(clonePath, { recursive: true, force: true })
    } catch {}

    throw new Error(
      `Failed to clone repository. Make sure it is public and the URL is correct. ${error instanceof Error ? error.message : ''}`
    )
  }
}

// Helper: fetch JSON from GitHub API
function fetchJSON(url: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'DevLens/1.0',
      'Accept': 'application/vnd.github.v3+json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    https.get(url, { headers }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.message && parsed.message.includes('Not Found')) {
            reject(new Error('Repository not found or is private'))
            return
          }
          if (parsed.message && parsed.message.includes('rate limit')) {
            reject(new Error('GitHub API rate limit exceeded. Add a GITHUB_TOKEN to your environment.'))
            return
          }
          resolve(parsed)
        } catch {
          reject(new Error('Failed to parse GitHub API response'))
        }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

// Helper: fetch raw file content
function fetchRaw(url: string, token?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'DevLens/1.0'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    https.get(url, { headers }, (res) => {
      // Handle redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        if (res.headers.location) {
          fetchRaw(res.headers.location, token).then(resolve).catch(reject)
          return
        }
      }

      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}
