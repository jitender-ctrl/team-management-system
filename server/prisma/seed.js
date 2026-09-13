const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { name: "To Do", color: "#94A3B8", order: 0, isDefault: true },
  { name: "In Progress", color: "#3B82F6", order: 1, isDefault: false },
  { name: "Review", color: "#F59E0B", order: 2, isDefault: false },
  { name: "Done", color: "#22C55E", order: 3, isDefault: false, isDone: true },
];

async function upsertUser({ name, email, password, roleId, managerId, phone, jobTitle }) {
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {}, // don't clobber an existing account if the seed is re-run
    create: {
      name,
      email,
      password: hashed,
      roleId,
      managerId: managerId || null,
      phone: phone || null,
      jobTitle: jobTitle || null,
      emailVerified: true, // seeded/demo accounts skip the OTP step for convenience
    },
  });
}

async function main() {
  // ---------- ROLES ----------
  // `update` mirrors `create` here (not left empty) so re-running the seed
  // refreshes permission sets on roles that already exist — important since
  // this script has been run before with an older permission set.
  const adminPermissions = { "*": true };
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { permissions: adminPermissions },
    create: { name: "Admin", isSystem: true, permissions: adminPermissions },
  });

  const managerPermissions = {
    "clients.view": true,
    "clients.manage": true,
    "projects.view": true,
    "projects.manage": true,
    "tasks.view": true,
    "tasks.manage": true,
    "attendance.manage_own": true,
    "attendance.view_all": true,
    "complaints.manage": true,
  };
  const managerRole = await prisma.role.upsert({
    where: { name: "Manager" },
    update: { permissions: managerPermissions },
    create: { name: "Manager", isSystem: true, permissions: managerPermissions },
  });

  // Can run projects/tasks day-to-day and assign work to their own
  // reports, but can't manage the client list or team roster — that
  // stays with Manager/Admin. They still see clients they personally
  // handle (enforced in the client controller, not here).
  const teamLeadPermissions = {
    "clients.view": true,
    "projects.view": true,
    "tasks.view": true,
    "tasks.manage": true,
    "attendance.manage_own": true,
  };
  const teamLeadRole = await prisma.role.upsert({
    where: { name: "Team Lead" },
    update: { permissions: teamLeadPermissions },
    create: { name: "Team Lead", isSystem: true, permissions: teamLeadPermissions },
  });

  // Can move/update the status of tasks assigned to them and log
  // time/comments — but cannot create tasks or assign/reassign work to
  // anyone, including themselves. Only Team Lead/Manager/Admin (who hold
  // tasks.manage) can do that.
  const employeePermissions = {
    "clients.view": true,
    "projects.view": true,
    "tasks.view": true,
    "tasks.update_own": true,
    "attendance.manage_own": true,
  };
  const employeeRole = await prisma.role.upsert({
    where: { name: "Employee" },
    update: { permissions: employeePermissions },
    create: { name: "Employee", isSystem: true, permissions: employeePermissions },
  });

  // ---------- USERS ----------
  // You — Admin, and also acting as the top-level Team Lead for now.
  const jitender = await upsertUser({
    name: "Jitender",
    email: "jitender@glocalassist.com",
    password: "Jitender@2026",
    roleId: adminRole.id,
    jobTitle: "Admin / Team Lead",
  });

  const manager = await upsertUser({
    name: "Priya Sharma",
    email: "priya.manager@glocalassist.com",
    password: "Manager@2026",
    roleId: managerRole.id,
    managerId: jitender.id,
    jobTitle: "Manager",
  });

  const teamLead = await upsertUser({
    name: "Aman Verma",
    email: "aman.teamlead@glocalassist.com",
    password: "TeamLead@2026",
    roleId: teamLeadRole.id,
    managerId: manager.id,
    jobTitle: "Team Lead",
  });

  const employee1 = await upsertUser({
    name: "Riya Kapoor",
    email: "riya.employee@glocalassist.com",
    password: "Employee@2026",
    roleId: employeeRole.id,
    managerId: teamLead.id,
    jobTitle: "Software Developer",
  });

  const employee2 = await upsertUser({
    name: "Kabir Singh",
    email: "kabir.employee@glocalassist.com",
    password: "Employee@2026",
    roleId: employeeRole.id,
    managerId: teamLead.id,
    jobTitle: "QA Engineer",
  });

  console.log("\nSeeded team members (temporary passwords — change these after first login):");
  console.log("  Admin / Team Lead : jitender@glocalassist.com        / Jitender@2026");
  console.log("  Manager           : priya.manager@glocalassist.com   / Manager@2026");
  console.log("  Team Lead         : aman.teamlead@glocalassist.com   / TeamLead@2026");
  console.log("  Employee          : riya.employee@glocalassist.com   / Employee@2026");
  console.log("  Employee          : kabir.employee@glocalassist.com  / Employee@2026");

  // ---------- CLIENTS ----------
  // Looked up by name (Client has no natural unique field) so re-running the
  // seed on a database that already has this demo data doesn't duplicate it.
  let clientA = await prisma.client.findFirst({ where: { name: "Acme Retail Pvt Ltd" } });
  if (!clientA) {
    clientA = await prisma.client.create({
      data: {
        name: "Acme Retail Pvt Ltd",
        company: "Acme Retail",
        email: "contact@acmeretail.example",
        phone: "+91 98765 43210",
        handledById: teamLead.id,
        engagementType: "FULL_TIME",
        createdById: jitender.id,
      },
    });
  }

  let clientB = await prisma.client.findFirst({ where: { name: "Bright Path Consulting" } });
  if (!clientB) {
    clientB = await prisma.client.create({
      data: {
        name: "Bright Path Consulting",
        company: "Bright Path",
        email: "hello@brightpath.example",
        phone: "+91 91234 56780",
        handledById: manager.id,
        engagementType: "PART_TIME",
        createdById: jitender.id,
      },
    });
  }

  // ---------- DEMO PROJECT ----------
  const existingProject = await prisma.project.findFirst({ where: { name: "Website Redesign" } });
  let project = existingProject;
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "Website Redesign",
        description: "Demo project — redesign of the Acme Retail marketing site.",
        clientId: clientA.id,
        createdById: jitender.id,
        statuses: { create: DEFAULT_STATUSES },
        members: {
          create: [
            { userId: jitender.id, roleInProject: "Owner" },
            { userId: teamLead.id, roleInProject: "Member" },
            { userId: employee1.id, roleInProject: "Member" },
            { userId: employee2.id, roleInProject: "Member" },
          ],
        },
        conversation: { create: { type: "PROJECT" } },
      },
      include: { statuses: true },
    });

    const [todo, inProgress, review, done] = project.statuses.sort((a, b) => a.order - b.order);

    await prisma.task.createMany({
      data: [
        {
          projectId: project.id,
          statusId: todo.id,
          title: "Set up homepage wireframes",
          description: "Rough layout for the new homepage — hero, featured products, footer.",
          priority: "HIGH",
          assigneeId: employee1.id,
          createdById: jitender.id,
          assignedById: jitender.id,
          assignedAt: new Date(),
          order: 0,
        },
        {
          projectId: project.id,
          statusId: inProgress.id,
          title: "Build product listing page",
          description: "Implement the responsive product grid with filters.",
          priority: "MEDIUM",
          assigneeId: employee2.id,
          createdById: teamLead.id,
          assignedById: teamLead.id,
          assignedAt: new Date(),
          order: 0,
        },
        {
          projectId: project.id,
          statusId: review.id,
          title: "QA checkout flow",
          description: "End-to-end test of add-to-cart through payment confirmation.",
          priority: "URGENT",
          assigneeId: employee2.id,
          createdById: teamLead.id,
          assignedById: teamLead.id,
          assignedAt: new Date(),
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          order: 1,
        },
        {
          projectId: project.id,
          statusId: done.id,
          title: "Kickoff meeting notes",
          description: "Summary of the project kickoff call with Acme Retail.",
          priority: "LOW",
          assigneeId: employee1.id,
          createdById: jitender.id,
          assignedById: jitender.id,
          assignedAt: new Date(),
          order: 0,
        },
      ],
    });
  }

  // A few more clients so there's a realistic-looking roster to test
  // search/filter/handler-assignment against.
  const moreClientsData = [
    {
      name: "Nimbus Cloud Services",
      company: "Nimbus Cloud",
      email: "ops@nimbuscloud.example",
      phone: "+91 90000 11111",
      handledById: teamLead.id,
      engagementType: "FULL_TIME",
    },
    {
      name: "Greenfield Foods",
      company: "Greenfield",
      email: "procurement@greenfieldfoods.example",
      phone: "+91 90000 22222",
      handledById: manager.id,
      engagementType: "PART_TIME",
    },
    {
      name: "Starline Logistics",
      company: "Starline",
      email: "contact@starlinelogistics.example",
      phone: "+91 90000 33333",
      handledById: jitender.id,
      engagementType: "FULL_TIME",
    },
  ];
  const seededExtraClients = {};
  for (const c of moreClientsData) {
    let client = await prisma.client.findFirst({ where: { name: c.name } });
    if (!client) client = await prisma.client.create({ data: { ...c, createdById: jitender.id } });
    seededExtraClients[c.name] = client;
  }
  const clientC = seededExtraClients["Nimbus Cloud Services"];

  // ---------- DEMO PROJECT 2: Mobile App Revamp (Nimbus Cloud) ----------
  let project2 = await prisma.project.findFirst({ where: { name: "Mobile App Revamp" } });
  if (!project2) {
    project2 = await prisma.project.create({
      data: {
        name: "Mobile App Revamp",
        description: "Demo project — rebuilding Nimbus Cloud's customer mobile app.",
        clientId: clientC.id,
        createdById: manager.id,
        statuses: { create: DEFAULT_STATUSES },
        members: {
          create: [
            { userId: manager.id, roleInProject: "Owner" },
            { userId: teamLead.id, roleInProject: "Member" },
            { userId: employee1.id, roleInProject: "Member" },
            { userId: employee2.id, roleInProject: "Member" },
          ],
        },
        conversation: { create: { type: "PROJECT" } },
      },
      include: { statuses: true },
    });
    const [todo2, inProgress2] = project2.statuses.sort((a, b) => a.order - b.order);

    await prisma.task.createMany({
      data: [
        {
          projectId: project2.id,
          statusId: todo2.id,
          title: "Design onboarding screens",
          description: "First-run experience for new app users.",
          priority: "MEDIUM",
          assigneeId: employee1.id,
          createdById: manager.id,
          assignedById: manager.id,
          assignedAt: new Date(),
          order: 0,
        },
        {
          // Deliberately brings Kabir's total open workload to exactly the
          // 9-point cap (URGENT 4 + MEDIUM 2 from project 1, + HIGH 3 here)
          // — try assigning him anything else in the app to see the hard
          // block in action.
          projectId: project2.id,
          statusId: inProgress2.id,
          title: "Fix push notification bug",
          description: "Notifications aren't arriving on Android 14 devices.",
          priority: "HIGH",
          assigneeId: employee2.id,
          createdById: teamLead.id,
          assignedById: teamLead.id,
          assignedAt: new Date(),
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          order: 0,
        },
      ],
    });
  }

  // ---------- DEMO PROJECT 3: Internal CRM Tool (no client — internal work) ----------
  let project3 = await prisma.project.findFirst({ where: { name: "Internal CRM Tool" } });
  if (!project3) {
    project3 = await prisma.project.create({
      data: {
        name: "Internal CRM Tool",
        description: "Demo project — internal tooling, not billed to any client.",
        clientId: null,
        createdById: jitender.id,
        statuses: { create: DEFAULT_STATUSES },
        members: {
          create: [
            { userId: jitender.id, roleInProject: "Owner" },
            { userId: teamLead.id, roleInProject: "Member" },
            { userId: employee1.id, roleInProject: "Member" },
          ],
        },
        conversation: { create: { type: "PROJECT" } },
      },
      include: { statuses: true },
    });
    const [todo3] = project3.statuses.sort((a, b) => a.order - b.order);

    await prisma.task.createMany({
      data: [
        {
          projectId: project3.id,
          statusId: todo3.id,
          title: "Draft data export spec",
          description: "Outline what fields the CSV export needs to cover.",
          priority: "LOW",
          assigneeId: employee1.id,
          createdById: jitender.id,
          assignedById: jitender.id,
          assignedAt: new Date(),
          order: 0,
        },
      ],
    });
  }

  // ---------- MORE TEAM MEMBERS (second Team Lead + 2 more Employees) ----------
  const teamLead2 = await upsertUser({
    name: "Neha Gupta",
    email: "neha.teamlead@glocalassist.com",
    password: "TeamLead@2026",
    roleId: teamLeadRole.id,
    managerId: manager.id,
    jobTitle: "Team Lead",
  });

  const employee3 = await upsertUser({
    name: "Karan Mehta",
    email: "karan.employee@glocalassist.com",
    password: "Employee@2026",
    roleId: employeeRole.id,
    managerId: teamLead2.id,
    jobTitle: "Business Analyst",
  });

  const employee4 = await upsertUser({
    name: "Sana Ali",
    email: "sana.employee@glocalassist.com",
    password: "Employee@2026",
    roleId: employeeRole.id,
    managerId: teamLead2.id,
    jobTitle: "UI/UX Designer",
  });

  console.log("  Team Lead         : neha.teamlead@glocalassist.com   / TeamLead@2026");
  console.log("  Employee          : karan.employee@glocalassist.com  / Employee@2026");
  console.log("  Employee          : sana.employee@glocalassist.com   / Employee@2026");

  // ---------- MORE CLIENTS (including a termination example) ----------
  const evenMoreClientsData = [
    { name: "Vantage Legal Group", company: "Vantage Legal", email: "info@vantagelegal.example", handledById: teamLead2.id, engagementType: "FULL_TIME" },
    { name: "Skyline Realty", company: "Skyline Realty", email: "sales@skylinerealty.example", handledById: employee3.id, engagementType: "PART_TIME" },
    { name: "Oakridge Manufacturing", company: "Oakridge Mfg", email: "contact@oakridgemfg.example", handledById: employee4.id, engagementType: "FULL_TIME" },
    { name: "Pinnacle Health", company: "Pinnacle Health", email: "admin@pinnaclehealth.example", handledById: jitender.id, engagementType: "PART_TIME" },
  ];
  const seededMoreClients = {};
  for (const c of evenMoreClientsData) {
    let client = await prisma.client.findFirst({ where: { name: c.name } });
    if (!client) client = await prisma.client.create({ data: { ...c, createdById: jitender.id } });
    seededMoreClients[c.name] = client;
  }

  // A client whose engagement has been TERMINATED — handledById is null,
  // and the history entry below explains why. Demonstrates the
  // termination-tracking flow directly, without needing to click through
  // the UI first.
  let vertexAnalytics = await prisma.client.findFirst({ where: { name: "Vertex Analytics" } });
  if (!vertexAnalytics) {
    vertexAnalytics = await prisma.client.create({
      data: {
        name: "Vertex Analytics",
        company: "Vertex Analytics",
        email: "hello@vertexanalytics.example",
        handledById: null,
        engagementType: "PART_TIME",
        createdById: jitender.id,
      },
    });
    await prisma.clientHandlerHistory.create({
      data: {
        clientId: vertexAnalytics.id,
        previousHandlerId: employee2.id, // Kabir
        newHandlerId: null,
        reason: "Contract ended after the initial project wrapped up; client paused further engagement due to budget cuts.",
        changedById: manager.id,
      },
    });
  }

  // A transfer example on an existing client — Bright Path Consulting was
  // originally handled by the Team Lead before being handed to the
  // Manager. (clientB's *current* handledById was already set to the
  // Manager above; this just records the history leading up to that.)
  const existingTransferHistory = await prisma.clientHandlerHistory.findFirst({
    where: { clientId: clientB.id, previousHandlerId: teamLead.id, newHandlerId: manager.id },
  });
  if (!existingTransferHistory) {
    await prisma.clientHandlerHistory.create({
      data: {
        clientId: clientB.id,
        previousHandlerId: teamLead.id,
        newHandlerId: manager.id,
        reason: "Team Lead's plate got full with Acme Retail; handing Bright Path to the Manager for continuity.",
        changedById: jitender.id,
      },
    });
  }

  // ---------- DEMO PROJECT 4: Legal Contract Portal (Vantage Legal) ----------
  let project4 = await prisma.project.findFirst({ where: { name: "Legal Contract Portal" } });
  if (!project4) {
    project4 = await prisma.project.create({
      data: {
        name: "Legal Contract Portal",
        description: "Demo project — a self-serve contract portal for Vantage Legal Group.",
        clientId: seededMoreClients["Vantage Legal Group"].id,
        createdById: teamLead2.id,
        statuses: { create: DEFAULT_STATUSES },
        members: {
          create: [
            { userId: teamLead2.id, roleInProject: "Owner" },
            { userId: employee3.id, roleInProject: "Member" },
            { userId: employee4.id, roleInProject: "Member" },
          ],
        },
        conversation: { create: { type: "PROJECT" } },
      },
      include: { statuses: true },
    });
    const [todo4, inProgress4] = project4.statuses.sort((a, b) => a.order - b.order);
    await prisma.task.createMany({
      data: [
        {
          projectId: project4.id,
          statusId: todo4.id,
          title: "Draft contract template schema",
          priority: "MEDIUM",
          assigneeId: employee3.id,
          createdById: teamLead2.id,
          assignedById: teamLead2.id,
          assignedAt: new Date(),
          order: 0,
        },
        {
          projectId: project4.id,
          statusId: inProgress4.id,
          title: "Design e-signature flow",
          priority: "HIGH",
          assigneeId: employee4.id,
          createdById: teamLead2.id,
          assignedById: teamLead2.id,
          assignedAt: new Date(),
          dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          order: 0,
        },
      ],
    });
  }

  // ---------- DEMO PROJECT 5: Realty Listings Site (Skyline Realty) ----------
  let project5 = await prisma.project.findFirst({ where: { name: "Realty Listings Site" } });
  if (!project5) {
    project5 = await prisma.project.create({
      data: {
        name: "Realty Listings Site",
        description: "Demo project — public listings site for Skyline Realty.",
        clientId: seededMoreClients["Skyline Realty"].id,
        createdById: teamLead2.id,
        statuses: { create: DEFAULT_STATUSES },
        members: {
          create: [
            { userId: teamLead2.id, roleInProject: "Owner" },
            { userId: employee3.id, roleInProject: "Member" },
          ],
        },
        conversation: { create: { type: "PROJECT" } },
      },
      include: { statuses: true },
    });
    const [todo5] = project5.statuses.sort((a, b) => a.order - b.order);
    await prisma.task.createMany({
      data: [
        {
          projectId: project5.id,
          statusId: todo5.id,
          title: "Set up property search filters",
          priority: "LOW",
          assigneeId: employee3.id,
          createdById: teamLead2.id,
          assignedById: teamLead2.id,
          assignedAt: new Date(),
          order: 1,
        },
      ],
    });
  }

  // ---------- ATTENDANCE DEMO DATA (today) ----------
  // Gives the Attendance page and the manager's Team Attendance table
  // something real to show. Riya's break total is deliberately pushed
  // over 60 minutes to demonstrate the red over-break-limit alert.
  function todayDateOnly() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const today = todayDateOnly();
  const nineAM = new Date(today);
  nineAM.setHours(9, 0, 0, 0);

  async function seedAttendanceDay(userId, breaksMinutes) {
    const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId, date: today } } });
    if (existing) return; // don't duplicate on re-run
    const attendance = await prisma.attendance.create({
      data: { userId, date: today, checkIn: nineAM },
    });
    let cursor = new Date(nineAM.getTime() + 2 * 60 * 60 * 1000); // first break ~2h after check-in
    for (const minutes of breaksMinutes) {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + minutes * 60 * 1000);
      await prisma.breakLog.create({
        data: { attendanceId: attendance.id, type: "Lunch", startTime: start, endTime: end },
      });
      cursor = new Date(end.getTime() + 60 * 60 * 1000); // next break an hour after the last ends
    }
  }

  await seedAttendanceDay(employee1.id, [75]); // Riya — 75 min, over the 60-min limit
  await seedAttendanceDay(employee2.id, [30]); // Kabir — normal
  await seedAttendanceDay(employee3.id, [20, 15]); // Karan — two short breaks, well under limit
  await seedAttendanceDay(employee4.id, [45]); // Sana — under limit
  await seedAttendanceDay(teamLead.id, [30]);
  await seedAttendanceDay(teamLead2.id, [40]);

  console.log(
    `\nSeeded demo data: ${2 + moreClientsData.length + 5} clients, 5 projects (Website Redesign, Mobile App Revamp, Internal CRM Tool, Legal Contract Portal, Realty Listings Site) with tasks spread across a 9-person team.`
  );
  console.log("Kabir Singh's open workload is intentionally set to the 9-point cap — try assigning him another task to see the hard block.");
  console.log("Riya Kapoor's break time today is intentionally over the 60-minute limit — check Attendance to see the red alert.");
  console.log("Vertex Analytics shows a TERMINATED client engagement (was Kabir's); Bright Path Consulting shows a TRANSFER history (Team Lead \u2192 Manager).");
  console.log("Seed complete.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
