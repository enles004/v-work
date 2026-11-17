import { describe, expect, it } from "vitest";

import { extractIdentity, filterMyTasks } from "../src/tools/mine.js";

const me = {
  data: {
    account: { id: "acc-1", fullName: "Phước Nguyễn", username: "phuoc.nguyen", email: "p@x.vn" },
  },
};

const docs = [
  { doc_id: "a", title: "Task của tôi", assignee: { name: "Phước Nguyễn" }, status: "todo" },
  { doc_id: "b", title: "Task của người khác", assignee: "An", status: "todo" },
  { doc_id: "c", title: "Task qua username", assignee: { username: "phuoc.nguyen" }, status: "done" },
  { doc_id: "d", title: "Task qua id", assignee: { id: "acc-1" }, status: "doing" },
];

describe("extractIdentity", () => {
  it("lấy name/username/email/id từ envelope", () => {
    const identity = extractIdentity(me);
    expect(identity.name).toBe("Phước Nguyễn");
    expect(identity.username).toBe("phuoc.nguyen");
    expect(identity.id).toBe("acc-1");
  });
});

describe("filterMyTasks", () => {
  it("chỉ giữ doc thuộc về tôi (name/username/id)", () => {
    const identity = extractIdentity(me);
    expect(filterMyTasks(docs, identity).map((d) => d.doc_id)).toEqual(["a", "c", "d"]);
  });

  it("bỏ task done khi includeDone=false", () => {
    const identity = extractIdentity(me);
    expect(filterMyTasks(docs, identity, { includeDone: false }).map((d) => d.doc_id)).toEqual([
      "a",
      "d",
    ]);
  });

  it("lọc thêm theo status", () => {
    const identity = extractIdentity(me);
    expect(filterMyTasks(docs, identity, { status: "doing" }).map((d) => d.doc_id)).toEqual(["d"]);
  });
});

describe("profile phẳng từ /user/getUserInfo", () => {
  const profile = {
    id: "acc-9",
    username: "phuoclh",
    full_name: "Lê Hữu Phước",
    email: "",
  };

  it("lấy được tên, shortName, username", () => {
    const identity = extractIdentity(profile);
    expect(identity.name).toBe("Lê Hữu Phước");
    expect(identity.shortName).toBe("Phước");
    expect(identity.username).toBe("phuoclh");
    expect(identity.email).toBeUndefined();
  });

  it("khớp task ghi owner bằng tên gọi", () => {
    const identity = extractIdentity(profile);
    const docs = [{ doc_id: "x", data: { owner: "Phước", status: "Chưa làm" } }];
    expect(filterMyTasks(docs, identity)).toHaveLength(1);
  });
});

describe("khớp tên chính xác", () => {
  const identity = { name: "Lê Hữu Phước", shortName: "Phước", username: "phuoclh" };

  it("không nhận task của người có tên chứa tên mình", () => {
    const docs = [{ doc_id: "x", data: { owner: "Phước Anh", status: "Chưa làm" } }];
    expect(filterMyTasks(docs, identity)).toHaveLength(0);
  });

  it("nhận task owners[] và nhiều người", () => {
    const docs = [
      { doc_id: "a", data: { owners: ["Linh", "Phước"], status: "Chưa làm" } },
      { doc_id: "b", data: { owner: "Linh + Phước", status: "Chưa làm" } },
    ];
    expect(filterMyTasks(docs, identity).map((d) => d.doc_id)).toEqual(["a", "b"]);
  });
});
