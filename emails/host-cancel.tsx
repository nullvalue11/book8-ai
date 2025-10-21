import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface HostCancelProps {
  bookingTitle: string
  guestName: string
  guestEmail: string
  timeGuest: string
  timeHost: string
  guestTimeZone: string
  hostTimeZone: string
  manageLink: string
  showDualTz?: boolean
}

export default function HostCancel({
  bookingTitle = 'Meeting',
  guestName = 'Guest',
  guestEmail = 'guest@example.com',
  timeGuest = 'Monday, October 14, 2:00 PM PDT',
  timeHost = 'Monday, October 14, 5:00 PM EDT',
  guestTimeZone = 'PDT',
  hostTimeZone = 'EDT',
  manageLink = 'https://example.com/bookings',
  showDualTz = true,
}: HostCancelProps) {
  return (
    <Html>
      <Head />
      <Preview>{guestName} canceled {bookingTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png"
              width="120"
              height="auto"
              alt="Book8 AI"
              style={logo}
            />
          </Section>

          <Section style={content}>
            <Heading style={h1}>❌ Booking Canceled</Heading>

            <Text style={text}>
              <strong>{guestName}</strong> has canceled their booking with you.
            </Text>

            <Section style={bookingBox}>
              <Heading as="h2" style={h2}>
                {bookingTitle}
              </Heading>

              <Section style={timeSection}>
                <Text style={timeLabel}>Canceled Time:</Text>
                <Text style={timeValue}>{timeHost}</Text>
                {showDualTz && guestTimeZone !== hostTimeZone && (
                  <Text style={timeValueAlt}>({timeGuest})</Text>
                )}
              </Section>

              <Hr style={hrSmall} />

              <Text style={guestInfo}>
                <strong>Guest:</strong> {guestName}
              </Text>
              <Text style={guestInfo}>
                <strong>Email:</strong> {guestEmail.substring(0, 3)}***
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Link href={manageLink} style={button}>
                View All Bookings
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              This time slot is now available for other bookings. The event has been removed from your calendar.
            </Text>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>
              Powered by <span style={brandText}>Book8 AI</span>
            </Text>
            <Text style={footerSubtext}>Intelligent Booking & Automation</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#0E1A26',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
}

const header = {
  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
  padding: '48px 32px',
  textAlign: 'center' as const,
  borderRadius: '8px 8px 0 0',
}

const logo = {
  margin: '0 auto',
  padding: '24px',
}

const content = {
  backgroundColor: '#1B2733',
  padding: '40px 32px',
  borderRadius: '0 0 8px 8px',
}

const h1 = {
  color: '#FFFFFF',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 24px 0',
}

const h2 = {
  color: '#FFFFFF',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px 0',
}

const text = {
  color: '#E5E7EB',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
}

const bookingBox = {
  backgroundColor: '#0E1A26',
  border: '1px solid #2E3A47',
  borderLeft: '4px solid #EF4444',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const timeSection = {
  marginBottom: '16px',
}

const timeLabel = {
  color: '#B6C4D1',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px 0',
}

const timeValue = {
  color: '#EF4444',
  fontSize: '15px',
  textDecoration: 'line-through',
  margin: '0',
}

const timeValueAlt = {
  color: '#F87171',
  fontSize: '13px',
  margin: '4px 0 0 0',
}

const hrSmall = {
  borderColor: '#2E3A47',
  margin: '16px 0',
}

const guestInfo = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '8px 0',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#64748B',
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  borderRadius: '8px',
}

const hr = {
  borderColor: '#2E3A47',
  margin: '24px 0',
}

const footer = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '0',
}

const footerSection = {
  backgroundColor: '#0E1A26',
  padding: '24px 32px',
  textAlign: 'center' as const,
  borderTop: '1px solid #2E3A47',
  borderRadius: '0 0 8px 8px',
}

const footerText = {
  color: '#B6C4D1',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 12px 0',
}

const brandText = {
  background: 'linear-gradient(135deg, #65E0C1, #8FD0FF)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: '600',
}

const footerSubtext = {
  color: '#B6C4D1',
  fontSize: '12px',
  margin: '0',
}
