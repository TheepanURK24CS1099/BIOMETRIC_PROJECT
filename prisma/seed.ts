// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: 'Hostel Warden',
    },
  })
  console.log('✅ Admin created:', admin.username)

  // Create sample students
  const students = [
    { name: 'Priya Sharma', roomNumber: 'A-101', parentPhone: '9876543210', fingerprintId: 'FP001' },
    { name: 'Meera Patel', roomNumber: 'A-102', parentPhone: '9876543211', fingerprintId: 'FP002' },
    { name: 'Ananya Krishnan', roomNumber: 'B-201', parentPhone: '9876543212', fingerprintId: 'FP003' },
    { name: 'Divya Nair', roomNumber: 'B-202', parentPhone: '9876543213', fingerprintId: 'FP004' },
    { name: 'Kavitha Reddy', roomNumber: 'C-301', parentPhone: '9876543214', fingerprintId: 'FP005' },
    { name: 'Ayesha Khan', roomNumber: 'C-302', parentPhone: '9876543215', fingerprintId: 'FP008' },
  ]

  for (const s of students) {
    await prisma.student.upsert({
      where: { fingerprintId: s.fingerprintId },
      update: {},
      create: s,
    })
  }
  console.log('✅ Sample students created')
  console.log('🎉 Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
