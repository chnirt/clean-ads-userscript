# Clean Ads — Hướng dẫn cài đặt

Userscript ẩn quảng cáo phổ biến, xử lý popup và thử bỏ qua quảng cáo video. Cài xong là tự chạy.

Script tải bộ lọc AdGuard Base và AdGuard Popups, giữ bản đã biên dịch khoảng 4 ngày, rồi chặn domain quảng cáo và ẩn phần tử theo các rule đó. Lần đầu mở trang có thể tải vài MB. Scriptlet của AdGuard không chạy ở đây; YouTube và player phim vẫn dùng phần bỏ qua quảng cáo riêng.

**Link cài đặt:** [Clean Ads – GitHub Gist](https://gist.github.com/chnirt/fa5a2886949e1e72da908d8bcfabf144#file-clean-ads-user-js)

## Chrome (Mac / Windows)

Trên iPhone hãy dùng Safari ở mục dưới. Chrome iPhone không cài được userscript.

1. Cài [Tampermonkey](https://www.tampermonkey.net/) từ Chrome Web Store.
2. Mở `chrome://extensions/` → **Tampermonkey** → **Details** → bật **Allow User Scripts**.
   Không thấy mục này thì bật **Developer mode** ở góc trên phải, rồi kiểm tra lại.
   Chrome có thể cảnh báo extension chạy mã chưa được Google xem xét. Chỉ bật nếu bạn tin mã nguồn Clean Ads.
3. Mở [Gist](https://gist.github.com/chnirt/fa5a2886949e1e72da908d8bcfabf144#file-clean-ads-user-js) → **Raw** → **Install**.
4. Icon Tampermonkey phải hiện Clean Ads đang bật. Tải lại trang (`Cmd + R` / `Ctrl + R`).

## Safari (iPhone / iPad / Mac)

1. Cài [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) từ App Store. Trên iPhone/iPad, mở app và chọn **Set Userscripts Directory** nếu được hỏi.
2. Bật extension:
   - iPhone/iPad: **Cài đặt → Safari → Extensions → Userscripts** (iOS mới: **Cài đặt → Ứng dụng → Safari → Extensions**). Chọn **Always Allow → All Websites**.
   - Mac: Safari → **Settings → Extensions** → bật Userscripts và cho phép mọi website.
3. Mở [Gist](https://gist.github.com/chnirt/fa5a2886949e1e72da908d8bcfabf144#file-clean-ads-user-js) bằng Safari → **Raw**.
4. iPhone: nút **aA** → **Userscripts** → cài. iPad/Mac: mở Userscripts và xác nhận cài.
5. Tải lại trang cần dùng.

Không thấy lời nhắc cài thì kiểm tra địa chỉ có kết thúc bằng `.user.js`. Có thể tải file và chép vào thư mục Userscripts.

Cần quyền mọi website vì quảng cáo player thường nằm ở domain khác trang phim.

## Cập nhật

Có bản mới trên Gist thì mở **Raw** và cài lại. Bản đã cài không tự đổi theo Gist. Chrome và Safari cập nhật riêng.

Chỉ cài từ nguồn bạn tin. Script không chặn được mọi quảng cáo. Nếu không chạy, kiểm tra quyền extension, script đang bật, rồi tải lại trang.
