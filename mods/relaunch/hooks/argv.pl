# argv.pl <pid>: 그 프로세스의 실행 인자를 한 줄에 하나씩, 각 줄을 16진수로 낸다.
use strict;
my $pid = shift;
my @args;
if (-r "/proc/$pid/cmdline") {
  open(my $fh, '<', "/proc/$pid/cmdline") or exit 1;
  local $/; my $raw = <$fh>;
  @args = split /\0/, $raw, -1; pop @args;
} else {
  my $mib = pack('i3', 1, 49, $pid);   # CTL_KERN, KERN_PROCARGS2
  my $len = 1 << 20;
  my $buf = "\0" x $len;
  my $size = pack('Q', $len);
  syscall(202, $mib, 3, $buf, $size, 0, 0) == 0 or exit 1;   # SYS___sysctl
  my $n = unpack('Q', $size);
  my $raw = substr($buf, 0, $n);
  my $argc = unpack('i', $raw);
  my $rest = substr($raw, 4);
  $rest =~ s/^[^\0]*\0+//;   # 실행 파일 경로와 뒤 패딩을 건너뛴다
  @args = (split /\0/, $rest, -1)[0 .. $argc - 1];
}
print unpack('H*', $_), "\n" for @args;
