import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'hv-webhook-secret-2026';

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const providedSecret = request.headers.get('x-webhook-secret');
    
    if (providedSecret !== WEBHOOK_SECRET) {
      console.error('[WhatsApp Webhook] Invalid secret:', providedSecret);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const payload = await request.json();
    
    console.log('[WhatsApp Webhook] Received message:', {
      groupId: payload.groupId,
      groupName: payload.groupName,
      senderName: payload.senderName,
      messageId: payload.messageId,
      timestamp: payload.timestamp,
      bodyLength: payload.body?.length || 0,
      mediaType: payload.mediaType,
    });

    // TODO: Store in database
    // For now, just log and acknowledge
    
    // You can add database storage here:
    // await db.whatsappMessages.create({
    //   data: {
    //     groupId: payload.groupId,
    //     groupName: payload.groupName,
    //     senderId: payload.from,
    //     senderName: payload.senderName,
    //     messageId: payload.messageId,
    //     body: payload.body,
    //     timestamp: new Date(payload.timestamp),
    //     mediaType: payload.mediaType,
    //     mediaUrl: payload.mediaUrl,
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp message received',
      messageId: payload.messageId,
    });

  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Handle GET requests (for health checks)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'WhatsApp webhook',
    methods: ['POST'],
  });
}
