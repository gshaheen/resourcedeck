#!/usr/bin/env node

/**
 * Fetch and display release download statistics from GitHub API
 */
const REPO = 'gshaheen/resourcedeck'

async function getStats() {
  const url = `https://api.github.com/repos/${REPO}/releases`
  const headers = {
    'User-Agent': 'resourcedeck-stats-checker',
    'Accept': 'application/vnd.github.v3+json'
  }

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
  }

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      if (res.status === 404) {
        console.log(`\nNo releases found yet for ${REPO}.`)
        return
      }
      throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`)
    }

    const releases = await res.json()
    if (!Array.isArray(releases) || releases.length === 0) {
      console.log(`\nNo releases found yet for ${REPO}.`)
      return
    }

    let totalDownloads = 0
    console.log(`\n========================================`)
    console.log(`  resourcedeck Release Download Stats   `)
    console.log(`========================================\n`)

    for (const release of releases) {
      console.log(`Tag: ${release.tag_name} (${release.name || 'Untitled'}) - Published: ${new Date(release.published_at).toLocaleDateString()}`)
      if (release.assets && release.assets.length > 0) {
        for (const asset of release.assets) {
          console.log(`  • ${asset.name.padEnd(45)} : ${asset.download_count} downloads`)
          totalDownloads += asset.download_count
        }
      } else {
        console.log(`  (No assets attached)`)
      }
      console.log('')
    }

    console.log(`----------------------------------------`)
    console.log(`Total Downloads Across All Releases: ${totalDownloads}`)
    console.log(`========================================\n`)
  } catch (err) {
    console.error('Error fetching download stats:', err.message)
  }
}

getStats()
