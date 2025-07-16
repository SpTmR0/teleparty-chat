import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Users, Send, Loader } from "lucide-react";
import { TelepartyClient, SocketMessageTypes } from "teleparty-websocket-lib";
import type {
  SocketEventHandler,
  SessionChatMessage,
} from "teleparty-websocket-lib";

const TelepartyChat: React.FC = () => {
  //States
  const [client, setClient] = useState<TelepartyClient | null>(null);
  const [connectionReady, setConnectionReady] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [othersTyping, setOthersTyping] = useState(false);
  const [userIcon, setUserIcon] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const myUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = "Teleparty Chat";
  }, []);

  //Initializing client
  useEffect(() => {
    const eventHandler: SocketEventHandler = {
      onConnectionReady: () => {
        console.log("Connection ready!");
        setConnectionReady(true);
      },
      onClose: () => {
        console.log("Connection closed");
        setConnectionReady(false);
        alert("Connection closed. Please reload the page.");
      },
      onMessage: (message) => {
        console.log("Received message type:", message.type);
        console.log("Message data:", message.data);

        //Handling different message types
        switch (message.type) {
          case "sendMessage": //handles chat messages
            setMessages((prev) => [
              ...prev,
              message.data as SessionChatMessage,
            ]);
            break;

          case "userId":
            console.log("Received user ID:", message.data);
            if (message.data && message.data.userId) {
              setMyUserId(message.data.userId);
              myUserIdRef.current = message.data.userId; //Storing in ref for immediate access
            }
            break;

          case "setTypingPresence": {
            const typingData = message.data as {
              anyoneTyping: boolean;
              usersTyping: string[];
            };
            console.log("Typing data:", typingData);
            console.log("My user ID from ref:", myUserIdRef.current);
            console.log("Users typing:", typingData.usersTyping);

            //Using ref instead of state for immediate comparison
            const othersTyping = typingData.usersTyping.filter(
              (id) => id !== myUserIdRef.current
            );
            console.log("Others typing:", othersTyping);

            setOthersTyping(othersTyping.length > 0);
            break;
          }

          case "userList":
            console.log("User list updated:", message.data);
            break;

          default:
            console.log("Unknown message type:", message.type);
        }
      },
    };

    const telepartyClient = new TelepartyClient(eventHandler);
    setClient(telepartyClient);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      telepartyClient.teardown(); //closing the websocket cleanly(to avoid leaks)
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  //creating a room
  const handleCreateRoom = async () => {
    if (!client || !nickname.trim()) return;

    setLoading(true);
    try {
      const roomId = await client.createChatRoom(nickname, userIcon);
      setCurrentRoom(roomId);
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  //joining a room
  const handleJoinRoom = async () => {
    if (!client || !nickname.trim() || !roomIdInput.trim()) return;

    setLoading(true);
    try {
      const messageList = await client.joinChatRoom(
        nickname,
        roomIdInput,
        userIcon
      );
      setMessages(messageList.messages || []);
      setCurrentRoom(roomIdInput);
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  //leaving a room
  const handleLeaveRoom = () => {
    if (client) {
      client.teardown();
    }
    setCurrentRoom(null);
    setMessages([]);
    setMessageInput("");
    setOthersTyping(false);
    setIsTyping(false);
  };

  //sending a message
  const handleSendMessage = () => {
    if (!client) return;

    const trimmed = messageInput.trim();

    if (!trimmed || trimmed.startsWith("data:image")) {
      return;
    }

    client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
      body: trimmed,
    });

    setMessageInput("");

    if (isTyping) {
      setIsTyping(false);
      client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: false,
      });
    }
  };

  //typing indicator
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    //Clearing existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!isTyping && e.target.value.trim() && client) {
      setIsTyping(true);
      client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: true,
      });
    }

    //Setting timeout to clear typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && client) {
        setIsTyping(false);
        client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
          typing: false,
        });
      }
    }, 2000); //2sec
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="bg-red-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Teleparty Chat</h1>
            <p className="text-gray-600 mt-2">Chat in sync with friends</p>
          </div>

          {!connectionReady ? (
            <div className="text-center py-8">
              <Loader className="w-8 h-8 animate-spin mx-auto text-red-600" />
              <p className="text-gray-600 mt-2">Connecting...</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose Your Icon
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["😀", "😎", "🤖", "👽", "👹", "🐶", "🐱", "🦁"].map(
                      (emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setUserIcon(emoji)}
                          className={`p-3 text-2xl rounded-lg border-2 transition-all ${
                            userIcon === emoji
                              ? "border-red-500 bg-red-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {emoji}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {userIcon && (
                  <div className="mt-3 text-sm flex items-center gap-2">
                    <span>Selected Icon:</span>
                    <span className="text-2xl">{userIcon}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Nickname
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter your nickname"
                  />
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleCreateRoom}
                    disabled={loading || !nickname.trim()}
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-gray-400"
                  >
                    {loading ? "Creating..." : "Create New Room"}
                  </button>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room ID
                  </label>
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Enter room ID to join"
                  />
                </div>

                <button
                  onClick={handleJoinRoom}
                  disabled={loading || !nickname.trim() || !roomIdInput.trim()}
                  className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors disabled:bg-gray-400"
                >
                  {loading ? "Joining..." : "Join Room"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/*Header bar*/}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 w-10 h-10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">
                Room ID: {currentRoom}
              </h2>
              <p className="text-sm text-gray-600">Nickname: {nickname}</p>
            </div>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="text-sm text-red-600 border border-red-600 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/*Messages Area*/}
      <div className="flex-1 max-w-4xl w-full mx-auto bg-white shadow-sm">
        <div className="h-[calc(100vh-180px)] overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.isSystemMessage
                  ? "justify-center"
                  : msg.userNickname === nickname
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  msg.isSystemMessage
                    ? "bg-gray-100 text-gray-600 text-sm italic"
                    : msg.userNickname === nickname
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {!msg.isSystemMessage && (
                  <div className="flex items-center space-x-2 mb-1">
                    {msg.userIcon && (
                      <span className="text-lg">{msg.userIcon}</span>
                    )}
                    <p className="text-xs font-semibold">{msg.userNickname}</p>
                  </div>
                )}

                <p>
                  {msg.isSystemMessage && msg.userNickname
                    ? `${msg.userNickname} ${msg.body}`
                    : msg.body}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}
          {othersTyping && (
            <div className="flex justify-center">
              {" "}
              <div className="bg-gray-200 px-4 py-2 rounded-2xl flex items-center space-x-2">
                <span className="text-sm text-gray-600">Someone is typing</span>
                <div className="flex space-x-1">
                  <div
                    className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/*Message Input*/}
      <div className="bg-white border-t">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={messageInput}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Type a message..."
            />
            <button
              onClick={handleSendMessage}
              disabled={
                !messageInput.trim() ||
                messageInput.trim().startsWith("data:image")
              }
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors disabled:bg-gray-400 flex items-center space-x-2"
            >
              <Send className="w-5 h-5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelepartyChat;
