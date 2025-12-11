import type {
  MessageRepositoryContract,
  SerializedMessage,
} from "@ioc:Repositories/MessageRepository";
import Channel from "App/Models/Channel";
import { DateTime } from 'luxon';

export default class MessageRepository implements MessageRepositoryContract {
  public async getAll(channelName: string): Promise<SerializedMessage[]> {
    const channel = await Channel.query()
      .where("name", channelName)
      .preload("messages", (messagesQuery) => messagesQuery.preload("author"))
      .firstOrFail();

    return channel.messages.map(
      (message) => message.serialize() as SerializedMessage
    );
  }

  public async create(
    channelName: string,
    userId: number,
    content: string
  ): Promise<SerializedMessage> {
    const channel = await Channel.findByOrFail("name", channelName);

    channel.updatedAt = DateTime.now();
    await channel.save();

    const message = await channel
      .related("messages")
      .create({ createdBy: userId, content });

    await message.load("author");
    return message.serialize() as SerializedMessage;
  }
}