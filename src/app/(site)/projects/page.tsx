import Link from 'next/link'
import { client } from '@/sanity/lib/client'

interface ProjectItem {
  _id: string
  title: string
  slug: { current: string }
  dateRange?: string
  description?: string
}

async function getProjects(): Promise<ProjectItem[]> {
  return client.fetch<ProjectItem[]>(
    `*[_type == "project" && isPage == true && !(_id in path("drafts.**"))] | order(order asc) {
      _id, title, slug, dateRange, description
    }`,
    {},
    { next: { revalidate: 60 } }
  )
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <>
      <div className="projects-list">
        {projects.map((project) => (
          <Link key={project._id} href={`/projects/${project.slug?.current}`} className="projects-item">
            {project.dateRange && <span className="projects-date">{project.dateRange}</span>}
            <div className="projects-info">
              <h2 className="projects-name">{project.title}</h2>
              {project.description && <p className="projects-desc">{project.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
